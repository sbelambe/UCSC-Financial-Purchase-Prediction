import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function Chatbot({ isOpen, onToggle }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI sales assistant. I can help you analyze sales data, identify trends, and answer questions about your dashboard. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const botResponse = generateBotResponse(inputValue);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 800);
  };

  const generateBotResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('revenue') || lowerQuestion.includes('sales')) {
      return "Based on the current data, your total revenue is trending upward with a 12.5% increase. Electronics and Office Supplies are your top-performing categories. Would you like me to provide more detailed insights?";
    } else if (lowerQuestion.includes('vendor') || lowerQuestion.includes('amazon') || lowerQuestion.includes('safeway') || lowerQuestion.includes('staples')) {
      return "Looking at your vendor purchases, you're buying the most from Amazon (office supplies and electronics). Items like printer paper and USB drives are frequently purchased, suggesting you may want to increase your internal stock. Conversely, specialty items from Safeway are purchased less frequently.";
    } else if (lowerQuestion.includes('product') || lowerQuestion.includes('category')) {
      return "Your product analysis shows that Electronics account for the largest share of revenue at 35%, followed by Office Supplies at 28%. Food & Beverages and Furniture have growth potential based on current trends.";
    } else if (lowerQuestion.includes('trend') || lowerQuestion.includes('forecast')) {
      return "Current trends show consistent growth in Q4 with a seasonal spike in November and December. Based on historical patterns, I recommend stocking up on high-demand items in preparation for the next quarter.";
    } else {
      return "I can help you with insights about revenue, sales trends, product performance, and vendor analysis. Could you please be more specific about what you'd like to know?";
    }
  };

  return (
    <>
      {/* Chatbot Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:scale-110 z-50"
          style={{ backgroundColor: '#003c6c' }}
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chatbot Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div
            className="flex items-center justify-between p-4 rounded-t-2xl text-white"
            style={{ backgroundColor: '#003c6c' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fdc700' }}>
                <Bot size={20} style={{ color: '#003c6c' }} />
              </div>
              <div>
                <h3 className="font-semibold">AI Sales Assistant</h3>
                <p className="text-xs opacity-90">Online</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="hover:bg-white hover:bg-opacity-20 rounded-lg p-1 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.sender === 'user'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                  style={message.sender === 'user' ? { backgroundColor: '#003c6c' } : {}}
                >
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ outlineColor: '#003c6c' }}
              />
              <button
                onClick={handleSend}
                className="px-4 py-2 rounded-lg text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#003c6c' }}
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              AI responses are simulated for this demo
            </p>
          </div>
        </div>
      )}
    </>
  );
}
