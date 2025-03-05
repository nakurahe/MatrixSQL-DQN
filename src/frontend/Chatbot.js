"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
/**
 * A simplistic chatbot-like UI that shows a puzzle prompt,
 * and lets the user type a SQL query.
 */
const Chatbot = ({ puzzlePrompt, onSubmitQuery, conversation }) => {
    const [input, setInput] = (0, react_1.useState)("");
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmitQuery(input);
        setInput("");
    };
    return (<div style={{ width: '400px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h2>SQL Puzzle Chatbot</h2>
      <div style={{ border: '1px solid #ccc', padding: '10px', height: '300px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '10px', color: 'blue' }}>
          <strong>Prompt:</strong> {puzzlePrompt}
        </div>
        {conversation.map((msg, idx) => (<div key={idx} style={{ margin: '5px 0' }}>
            <strong>{msg.role === 'user' ? 'You:' : 'System:'}</strong> {msg.text}
          </div>))}
      </div>
      <form onSubmit={handleSubmit} style={{ marginTop: '10px' }}>
        <input type="text" placeholder="Type your SQL query..." value={input} onChange={(e) => setInput(e.target.value)} style={{ width: '300px', marginRight: '5px' }}/>
        <button type="submit">Submit</button>
      </form>
    </div>);
};
exports.default = Chatbot;
