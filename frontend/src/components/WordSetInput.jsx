import React from 'react';
import i18n from '../i18n';

function getWordText(wordText) {
  if (typeof wordText === 'string') return wordText;
  if (wordText && typeof wordText === 'object') return wordText[i18n.language] || wordText.en || Object.values(wordText)[0] || '';
  return '';
}

export default function WordSetInput({ question, selectedWords = [], onChange }) {
  if (!question?.wordCloudOptions) return null;

  return (
    <div className="word-cloud-input">
      <div className="word-chips">
        {question.wordCloudOptions.words.map((word, index) => {
          const wordText = getWordText(word.text);
          const isSelected = selectedWords.includes(wordText);
          const maxReached = selectedWords.length >= question.maxSelections && !isSelected;

          return (
            <button
              key={index}
              className={`word-chip ${isSelected ? 'selected' : ''} ${maxReached ? 'disabled' : ''}`}
              style={{
                backgroundColor: isSelected ? word.color : '#f0f0f0',
                color: isSelected ? 'white' : '#333',
                opacity: maxReached ? 0.5 : 1,
              }}
              onClick={() => {
                const currentWords = selectedWords || [];
                let newWords;
                if (isSelected) newWords = currentWords.filter(w => w !== wordText);
                else if (currentWords.length < question.maxSelections) newWords = [...currentWords, wordText];
                else return;
                onChange(question.id, null, null, newWords);
              }}
              disabled={maxReached}
            >
              {wordText}
            </button>
          );
        })}
      </div>
      <div className="word-cloud-info">
        <small>
          {`Select up to ${question.maxSelections}`} ({`${selectedWords.length}/${question.maxSelections}`})
        </small>
      </div>
    </div>
  );
}
