// src/server/server.ts
import express, { Request, Response , Application } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DQNAgent } from "../agent/DQNAgent";
import { MatrixSQLEnvironment } from "../environment/MatrixSQLEnvironment";
import pg from "pg";
const { Pool } = pg;
import { Transition } from "../shared/types";
import { loadTransitionsFromCSV } from "../shared/utilities";
import { getGeneratedQuery } from "../shared/llmService";
import { easyQueries } from '../resources/easy_queries';
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory singletons for demonstration
let agent: DQNAgent | null = null;
let env: MatrixSQLEnvironment | null = null;
let numQueryTypes = 10;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_DATABASE
});

async function preTrain(DQNAgent: DQNAgent) {
  console.log("Loading transitions from CSV...");
  const transitions = await loadTransitionsFromCSV("src/resources/generated_data.csv");
  console.log(`Loaded ${transitions.length} transitions.`);

  console.log("Starting offline training (10 epochs) with batchSize=32...");
  await DQNAgent.offlineTrain(transitions);
  console.log("Offline training complete.");
}

async function initAgentEnv(numQueryTypes: number, pool: pg.Pool, preTrainAgent: boolean = true): Promise<number> {
  env = new MatrixSQLEnvironment(numQueryTypes, pool);
  env.reset();

  // create agent
  const inputDim = numQueryTypes;
  const outputDim = numQueryTypes;
  agent = new DQNAgent(inputDim, outputDim, 5000);
  if (preTrainAgent) {
    await preTrain(agent);
  }
  const oldState = env.getState();

  // 2) Agent chooses an action
  const action = agent.chooseAction(oldState.mastery);
  return action;
}

export async function startServer(port: number) {
  const app: Application = express();
  app.use(express.json());

  // Serve the static frontend from /views/pages
  app.use(express.static(join(__dirname, "../../public")));

  app.use("*", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Endpoint: set the game theme, schema and concepts
  app.post("/setup-form", async (req: Request, res: Response) => {
    try {
      const { theme, schema, concepts } = req.body;
      console.log("Received settings:", { theme, schema, concepts });
      // await getGeneratedQuery();
      // numQueryTypes = concepts.length;
      const action = await initAgentEnv(numQueryTypes, pool);
      res.set("Access-Control-Allow-Origin", "*");
      res.json({ action });
    } catch (error) {
      console.error(error);
      return res.status(400).json({ error: "Invalid request" });
    }
  });

  // app.get("/api/init", async (req: Request, res: Response) => {
  //   // Suppose we have 10 query types:
  //   const numQueryTypes = 10;
  //   // Create environment (assuming you have a PG pool or similar)
  //   const pool = new Pool({
  //       user: process.env.DB_USER,
  //       password: process.env.DB_PASSWORD,
  //       host: process.env.DB_HOST,
  //       port: Number(process.env.DB_PORT || 5432),
  //       database: process.env.DB_DATABASE
  //     });

  //   env = new MatrixSQLEnvironment(numQueryTypes, pool);
  //   env.reset();

  //   // create agent
  //   const inputDim = 10; // or how you define your mastery array dimension
  //   const outputDim = 10;
  //   agent = new DQNAgent(inputDim, outputDim, 5000);
  //   await preTrain(agent);
    
  //   res.json({ message: "Initialization done. Agent & Env created." });
  // });

  // Endpoint: user submits an SQL query, environment steps
  app.post("/submit-query", async (req: Request, res: Response) => {
    if (!agent || !env) {
      return res.status(400).json({ error: "Agent or Environment not initialized." });
    }

    const { userQuery } = req.body;
    console.log("Received user query:", userQuery);
     
    // Actually step the environment
    const oldState = env.getState();

    // 2) Agent chooses an action
    const action = agent.chooseAction(oldState.mastery);
    const expectedOutput: any = easyQueries[action as keyof typeof easyQueries].expected;
    const { nextState, reward } = await env.stepWithUserInput(action, expectedOutput, userQuery);

    // Observe transition
    const transition: Transition = {
      state: oldState,
      action,
      reward,
      nextState
    };
    agent.observe(transition);

    // Train
    await agent.trainBatch(16);

    // respond with updated mastery, reward, etc.
    res.json({
      newMastery: nextState.mastery,
      action,
      message: "Query processed"
    });
  });

  // Endpoint: ask agent to pick the best action given current mastery
  app.get("/api/getAction", (req, res) => {
    if (!agent || !env) {
      return res.status(400).json({ error: "Agent or Environment not initialized." });
    }
    const state = env.getState();
    const action = agent.chooseAction(state.mastery);
    res.json({ action });
  });

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
