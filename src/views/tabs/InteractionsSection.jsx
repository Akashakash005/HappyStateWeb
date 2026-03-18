import React, { useState } from 'react';
import './InteractionsSection.css';

export default function InteractionsSection() {
  const [interactions, setInteractions] = useState([]);

  const addInteraction = () => {
    setInteractions([
      ...interactions,
      { id: Date.now(), person: "", context: "", emotion: "neutral" }
    ]);
  };

  const updateInteraction = (index, field, value) => {
    const nextInteractions = [...interactions];
    // Immutably update the specific interaction object
    nextInteractions[index] = { ...nextInteractions[index], [field]: value };
    setInteractions(nextInteractions);
  };

  const removeInteraction = (index) => {
    setInteractions(interactions.filter((_, i) => i !== index));
  };

  return (
    <div className="interactions-container">
      <div className="interactions-header">
        <h4>Interactions (Optional)</h4>
        <button className="secondary-btn" onClick={addInteraction} type="button">
          + Add Interaction
        </button>
      </div>

      {interactions.map((item, index) => (
        <div className="interaction-card" key={item.id}>
          <div className="interaction-row">
            <input 
              placeholder="Person" 
              value={item.person} 
              onChange={(e) => updateInteraction(index, 'person', e.target.value)} 
            />

            <select 
              value={item.emotion} 
              onChange={(e) => updateInteraction(index, 'emotion', e.target.value)} 
            >
              <option value="positive">🙂 Positive</option>
              <option value="neutral">😐 Neutral</option>
              <option value="pressure">⚡ Pressure</option>
            </select>
            
            <button 
              className="remove-btn" 
              onClick={() => removeInteraction(index)}
              title="Remove interaction"
            >
              ✕
            </button>
          </div>

          <input 
            className="interaction-context" 
            placeholder="What happened?" 
            value={item.context} 
            onChange={(e) => updateInteraction(index, 'context', e.target.value)} 
          />
        </div>
      ))}
    </div>
  );
}