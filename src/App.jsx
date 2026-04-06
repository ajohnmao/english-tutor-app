import React, { useState, useEffect, useRef } from 'react';
import { Settings, Send, Volume2, Menu, X, Lightbulb, MessageSquare, AlertCircle, Mic, MicOff } from 'lucide-react';

const SCENARIOS = {
  Travel: ['Airport Check-in', 'Customs', 'Hotel Check-in', 'Ordering Food', 'Asking Directions', 'Duty-Free Shopping', 'Car Rental', 'Booking Tours', 'Lost Luggage', 'Pharmacy'],
  Work: ['Job Interview', 'Online Meeting', 'Presentation', 'Salary Negotiation', 'Small Talk', 'Business Email', 'Handling Complaints', 'Product Demo', 'Status Update', 'Office Repair'],
  Study: ['Campus Tour', 'Course Registration', 'Discussing Homework', 'Library', 'Club Activities', 'Study Abroad Interview', 'Group Discussion', 'Paying Tuition', 'Dorm Life', 'Language Exchange'],
  Life: ['First Date', 'Grocery Store', 'Haircut', 'Gym', 'New Neighbors', 'Party Intro', 'Movie Tickets', 'Cafe Chat', 'Borrowing Items', 'Emergency (911)']
};

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('gemini_api_key'));
  const [tempKey, setTempKey] = useState(apiKey);
  
  const [selectedScenario, setSelectedScenario] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
           transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = (e) => {
    e?.preventDefault();
    if (!recognitionRef.current) {
      alert('Your browser does not support Speech Recognition. Please use Chrome or Edge.');
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setInputText('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const saveApiKey = () => {
    setApiKey(tempKey);
    localStorage.setItem('gemini_api_key', tempKey);
    setShowSettings(false);
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9; // Slightly slower for better listening practice
      window.speechSynthesis.speak(utterance);
    }
  };

  const startScenario = async (scenario) => {
    setSelectedScenario(scenario);
    setSidebarOpen(false);
    setMessages([]);
    
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const initialUserMessage = {
      role: 'user',
      content: `I want to practice the scenario: ${scenario}. Please start the conversation as the English tutor. Keep your first response brief and engaging.`
    };
    
    setMessages([initialUserMessage]);
    await fetchReply([initialUserMessage], scenario);
  };

  const fetchReply = async (currentMessages, scenario) => {
    setIsLoading(true);
    try {
      const apiMessages = currentMessages.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.role === 'model' ? JSON.stringify(msg.data) : msg.content }]
      }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: { 
              text: `You are a friendly English tutor. For every message, you must respond in JSON format with three exact keys:\n1. "ai_reply": Your spoken response back to the user.\n2. "hint_en": A suggested full sentence the user could say next to continue the conversation.\n3. "hint_zh": The Chinese translation of that suggested sentence.\n\nThe current practice scenario is: ${scenario}. Keep your "ai_reply" natural, conversational, and tailored to the scenario. Always return strictly formatting valid JSON.` 
            }
          },
          contents: apiMessages,
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) {
         if (response.status === 400 || response.status === 403) throw new Error('API Key invalid or blocked.');
         throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const aiResponseText = data.candidates[0].content.parts[0].text;
      const aiData = JSON.parse(aiResponseText);

      setMessages(prev => [...prev, { role: 'model', data: aiData }]);
      speakText(aiData.ai_reply);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', error: true, content: error.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (isRecording) toggleRecording();
    if (!inputText.trim() || isLoading) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const newUserMsg = { role: 'user', content: inputText };
    const updatedMessages = [...messages, newUserMsg];
    
    setMessages(updatedMessages);
    setInputText('');
    await fetchReply(updatedMessages, selectedScenario);
  };

  const MessageBubble = ({ msg }) => {
    const [showHint, setShowHint] = useState(false);
    const isModel = msg.role === 'model';
    
    if (msg.error) {
       return (
         <div className="flex justify-center w-full my-4">
           <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-4 max-w-md flex items-start gap-3 shadow-sm">
             <AlertCircle className="shrink-0 mt-0.5" size={18} />
             <div className="text-sm">
               <p className="font-semibold mb-1">Failed to get response</p>
               <p>{msg.content}</p>
               <button onClick={() => setShowSettings(true)} className="mt-2 text-indigo-600 underline text-xs font-medium">Check API Settings</button>
             </div>
           </div>
         </div>
       );
    }

    return (
      <div className={`flex flex-col ${isModel ? 'items-start' : 'items-end'} mb-6 w-full`}>
         {/* User hidden starting prompt styling */}
         {!isModel && msg.content.startsWith('I want to practice the scenario:') && (
            <div className="text-xs text-gray-400 bg-gray-100 rounded-lg px-3 py-1 mb-2 font-medium border border-gray-200">System: Practice Started</div>
         )}
         
         <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm text-[15px] leading-relaxed ${isModel ? 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm' : 'bg-indigo-600 text-white rounded-tr-sm'}`}>
           {isModel ? msg.data.ai_reply : msg.content}
         </div>
         
         {isModel && (
           <div className="mt-2.5 flex flex-col items-start gap-2 max-w-[85%] sm:max-w-[75%] w-full">
             <div className="flex gap-2.5">
               <button onClick={() => speakText(msg.data.ai_reply)} title="Read Aloud" className="text-gray-500 hover:text-indigo-600 p-1.5 bg-white shadow-sm border border-gray-100 rounded-full transition-colors active:scale-95">
                 <Volume2 size={16} />
               </button>
               <button onClick={() => setShowHint(!showHint)} className={`flex items-center gap-1.5 text-sm font-medium px-3.5 py-1 rounded-full transition-all active:scale-95 shadow-sm border ${showHint ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-50'}`}>
                 <Lightbulb size={16} className={showHint ? 'text-yellow-500 fill-yellow-500' : ''} /> Hint (暗示)
               </button>
             </div>
             
             {showHint && (
               <div className="bg-amber-50/80 border border-amber-200/60 p-4 rounded-xl text-sm w-full mt-1.5 shadow-sm relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
                 <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                 <div className="flex justify-between items-start gap-2 mb-2 pl-2">
                   <p className="font-semibold text-gray-800 leading-snug">{msg.data.hint_en}</p>
                   <button onClick={() => speakText(msg.data.hint_en)} title="Pronounce Hint" className="text-amber-600 hover:bg-amber-100/80 p-1.5 rounded-full transition-colors shrink-0">
                     <Volume2 size={16} />
                   </button>
                 </div>
                 <p className="text-gray-600 pl-2 leading-snug">{msg.data.hint_zh}</p>
                 <div className="pl-2 mt-3">
                   <button onClick={() => {setInputText(msg.data.hint_en); setShowHint(false);}} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-md transition-colors border border-indigo-100">
                     Use this reply
                   </button>
                 </div>
               </div>
             )}
           </div>
         )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-100 transform transition-transform duration-300 ease-in-out flex flex-col shadow-xl md:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-5 flex justify-between items-center border-b border-gray-50 bg-white sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5 tracking-tight">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <MessageSquare className="text-white" size={18}/>
            </div>
            English Tutor
          </h1>
          <button className="md:hidden text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-md transition-colors" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-7 custom-scrollbar pb-24">
          {Object.entries(SCENARIOS).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                {category}
              </h2>
              <ul className="space-y-0.5">
                {items.map(scenario => (
                  <li key={scenario}>
                    <button
                      onClick={() => startScenario(scenario)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${selectedScenario === scenario ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'}`}
                    >
                      {scenario}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-white md:bg-transparent">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 py-3 sm:py-4 flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-gray-500 hover:text-gray-900 p-2 -ml-2 rounded-lg hover:bg-gray-50" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-0.5 md:hidden">Scenario</p>
              <h2 className="font-semibold text-gray-800 text-lg tracking-tight">
                {selectedScenario || 'Select a scenario'}
              </h2>
            </div>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 sm:px-4 sm:py-2 flex items-center gap-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors font-medium text-sm">
            <Settings size={18} className="shrink-0" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 scroll-smooth">
          {!selectedScenario && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50 transform rotate-3">
                <MessageSquare className="text-indigo-600 transform -rotate-3" size={36} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">AI English Practice</h3>
              <p className="text-gray-500 max-w-sm text-[15px] leading-relaxed">Choose a real-world scenario from the sidebar to start improving your conversational English.</p>
            </div>
          )}
          
          <div className="max-w-3xl mx-auto flex flex-col">
             {messages.map((msg, idx) => <MessageBubble key={idx} msg={msg} />)}
             
             {isLoading && (
               <div className="flex justify-start mb-6 w-full animate-in fade-in duration-200">
                 <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm p-4 shadow-sm flex gap-1.5 items-center justify-center w-16 h-12">
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                   <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                 </div>
               </div>
             )}
             <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* Input Form */}
        {selectedScenario && (
          <div className="bg-white border-t border-gray-100 p-4 sm:px-6 shrink-0 z-10 w-full shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
            <form onSubmit={sendMessage} className="max-w-3xl mx-auto relative group flex items-end gap-2 bg-gray-50 rounded-3xl border border-gray-200 p-2 transition-all focus-within:bg-white focus-within:shadow-[0_8px_30px_-8px_rgba(79,70,229,0.15)] focus-within:border-indigo-200">
              <button
                type="button"
                onClick={toggleRecording}
                className={`shrink-0 rounded-2xl h-[44px] w-[44px] flex items-center justify-center transition-all shadow-sm active:scale-95 ${isRecording ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'bg-white text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200'}`}
                title={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                placeholder={isRecording ? 'Listening...' : 'Type your reply or record your voice...'}
                disabled={isLoading}
                rows={1}
                className="w-full bg-transparent py-3 px-2 focus:outline-none resize-none max-h-32 min-h-[44px] disabled:opacity-50 text-[15px]"
                style={{ fieldSizing: 'content' }} 
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="shrink-0 bg-indigo-600 text-white rounded-2xl h-[44px] w-[44px] flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-400 transition-all shadow-sm active:scale-95"
              >
                <Send size={18} className="translate-x-[1px]" />
              </button>
            </form>
            <div className="text-center text-xs text-gray-400 mt-3 font-medium flex items-center justify-center gap-2">
              <Lightbulb size={12} className="text-amber-400" />
              Stuck? Check the hints to learn native phrases
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
                  <div className="bg-indigo-50 p-2 rounded-lg">
                    <Settings className="text-indigo-600" size={20}/>
                  </div>
                  System Setup
                </h2>
              </div>
              {apiKey && (
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>
            
            <p className="text-gray-500 text-[15px] mb-6 leading-relaxed">
              To power the voice and AI responses, please enter your free <strong className="text-gray-700">Gemini API Key</strong>. It remains securely in your browser's local storage.
            </p>
            
            <div className="mb-7">
              <label className="block text-sm font-semibold text-gray-700 mb-2">API Key</label>
              <input 
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono text-sm shadow-sm"
              />
              <div className="mt-3 flex items-center gap-1.5 text-sm">
                <span className="text-gray-400">Don't have one?</span>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline flex items-center">
                  Get it from Google Setup &rarr;
                </a>
              </div>
            </div>
            
            <button 
              onClick={saveApiKey}
              disabled={!tempKey.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all w-full shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] active:scale-[0.98]"
            >
              Start Practicing!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
