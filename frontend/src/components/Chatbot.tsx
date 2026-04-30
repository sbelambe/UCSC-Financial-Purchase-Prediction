import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles } from 'lucide-react';

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
  currentView?: 'dashboard' | 'dataset-explorer';
  dataset?: string;
  selectedVendor?: string;
  selectedCategory?: string;
  selectedTimePeriod?: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface GuidedQuestionGroup {
  id: string;
  title: string;
  description: string;
  questions: string[];
}

const GUIDED_QUESTION_GROUPS: GuidedQuestionGroup[] = [
  {
    id: 'past',
    title: 'Questions about the past',
    description: 'Historical purchase patterns and trend discovery.',
    questions: [
      'What items were bought the most from this vendor?',
      'What items were bought the most in the spring quarter?',
      'What items in the bookstore do not need to be stocked as often?',
    ],
  },
  {
    id: 'vendor',
    title: 'Vendor questions',
    description: 'Demand patterns tied to a specific vendor.',
    questions: [
      'What items will be bought the most from this vendor?',
      'Which items from this vendor are likely to repeat next quarter?',
      'What vendor items should we reorder first?',
    ],
  },
  {
    id: 'seasonal',
    title: 'Seasonal questions',
    description: 'Quarterly and seasonal forecasting questions.',
    questions: [
      'What items are bought the most in the spring quarter?',
      'How does demand change between spring and fall quarters?',
      'Which items will have higher demand next quarter?',
    ],
  },
  {
    id: 'bookstore',
    title: 'Bookstore stocking questions',
    description: 'Inventory and stocking frequency guidance.',
    questions: [
      'What items in the bookstore do not need to be stocked as often?',
      'Which bookstore items have low turnover and can be stocked less frequently?',
      'Which bookstore items should be prioritized for reordering?',
    ],
  },
];

interface ChatbotGuidanceResponse {
  answer: string;
  suggested_questions: string[];
  category?: string;
  source?: string;
}

export function Chatbot({
  isOpen,
  onToggle,
  currentView = 'dashboard',
  dataset = 'overall',
  selectedVendor = '',
  selectedCategory = '',
  selectedTimePeriod = '',
}: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your UCSC finance assistant. Try one of the guided questions below if you want help asking about historical demand, seasonal patterns, vendor trends, or bookstore stocking.",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const contextPayload = useMemo(
    () => ({
      current_view: currentView,
      dataset,
      selected_vendor: selectedVendor,
      selected_category: selectedCategory,
      selected_time_period: selectedTimePeriod,
      filters: {},
    }),
    [currentView, dataset, selectedVendor, selectedCategory, selectedTimePeriod]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const appendBotMessage = (text: string) => {
    const botMessage: Message = {
      id: (Date.now() + Math.random()).toString(),
      text,
      sender: 'bot',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, botMessage]);
  };

  const handleSend = async (overrideValue?: string) => {
    const question = (overrideValue ?? inputValue).trim();
    if (!question || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: question,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chatbot/guidance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          ...contextPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chatbot request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { status: string; data: ChatbotGuidanceResponse };
      const answer = payload?.data?.answer || 'I can help you refine your question about future demand.';
      const suggested = payload?.data?.suggested_questions || [];
      appendBotMessage(
        [
          answer,
          suggested.length > 0 ? `\n\nTry asking next:\n- ${suggested.join('\n- ')}` : '',
        ].join('')
      );
    } catch (error) {
      appendBotMessage(
        'I could not reach the chatbot service right now. Try one of the guided questions below to explore vendor, seasonal, or bookstore demand patterns.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const suggestedQuestions = GUIDED_QUESTION_GROUPS;

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
        <div className="fixed bottom-6 right-6 w-[26rem] max-w-[calc(100vw-1.5rem)] h-[680px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden">
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

          <div className="border-b border-gray-100 bg-slate-50 px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <Sparkles size={14} />
              Guided questions
            </div>
            <div className="max-h-44 space-y-3 overflow-y-auto pr-1">
              {suggestedQuestions.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{group.title}</p>
                    <p className="text-xs text-slate-500">{group.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.questions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => void handleSend(question)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 transition hover:border-[#003c6c] hover:text-[#003c6c]"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-white p-4 space-y-4">
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
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about vendor demand, spring quarter trends, or bookstore stocking..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ outlineColor: '#003c6c' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isSending}
                className="px-4 py-2 rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#003c6c' }}
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Gemini guidance is used when configured; otherwise the chatbot falls back to curated guidance.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
