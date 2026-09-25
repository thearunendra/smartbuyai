import { useEffect, useRef, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import {
  Bot,
  Camera,
  Headphones,
  History,
  Laptop,
  SendHorizontal,
  Smartphone,
  Sparkles,
  SquarePen
} from "lucide-react";
import Navbar from "../components/Navbar";
import ChatSidebar from "../components/ChatSidebar";
import ProductCard from "../components/ProductCard";
import { api } from "../api";
import { useAuth } from "../auth";
import "./Chatbot.css";

// Shown one after another while a search runs (about 8-10 seconds).
const loadingSteps = [
  { at: 0, text: "Searching live listings..." },
  { at: 2500, text: "Picking the best products for you..." },
  { at: 5000, text: "Comparing prices across stores..." }
];

const suggestions = [
  { icon: Smartphone, text: "Mobile under ₹20,000 with a good camera" },
  { icon: Laptop, text: "Laptop under ₹60,000 for coding" },
  { icon: Headphones, text: "ANC headphones under ₹5,000" },
  { icon: Camera, text: "Best camera for vlogging" }
];

// Saved messages use role "user" / "ai"; the UI uses type.
function fromSaved(message) {
  return {
    type: message.role === "user" ? "user" : "ai",
    text: message.text,
    error: message.error,
    products: message.products || []
  };
}

function Chatbot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { chatId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, checking } = useAuth();

  // The open conversation. id is null for a new (or guest) chat.
  const [chat, setChat] = useState({ id: null, messages: [], error: "" });
  const [chats, setChats] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const askedFromUrl = useRef(false);
  const chatRef = useRef(chat);

  // Keep the ref current for event handlers and the chat loader below.
  // Declared first so it runs before the other effects in each commit.
  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);

  const currentId = chatId ?? null;

  // The URL points at a chat that hasn't been loaded yet.
  const loadingChat = Boolean(chatId) && chat.id !== currentId;
  const messages = chat.id === currentId ? chat.messages : [];

  const refreshChats = () => {
    api("/api/chats")
      .then((data) => setChats(data.chats))
      .catch(() => setChats([]));
  };

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    api("/api/chats")
      .then((data) => {
        if (!ignore) setChats(data.chats);
      })
      .catch(() => {
        if (!ignore) setChats([]);
      });

    return () => {
      ignore = true;
    };
  }, [user]);

  // Open a saved chat when the URL changes to one we don't have yet.
  useEffect(() => {
    if (!chatId || chatRef.current.id === chatId) return;

    let ignore = false;

    api(`/api/chats/${chatId}`)
      .then((data) => {
        if (!ignore) {
          setChat({
            id: chatId,
            messages: data.messages.map(fromSaved),
            error: ""
          });
        }
      })
      .catch((error) => {
        if (!ignore) {
          setChat({ id: chatId, messages: [], error: error.message });
        }
      });

    return () => {
      ignore = true;
    };
  }, [chatId]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timers = loadingSteps.map((step, index) =>
      setTimeout(() => setLoadingStep(index), step.at)
    );

    return () => timers.forEach(clearTimeout);
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  const searchProducts = async (text) => {
    const userMessage = text.trim();

    if (!userMessage || loading || loadingChat) return;

    const conversationId = chatRef.current.id;
    const history = chatRef.current.messages;

    setChat({
      id: conversationId,
      messages: [...history, { type: "user", text: userMessage }],
      error: ""
    });

    setMessage("");
    setLoading(true);

    let reply;
    let savedId = conversationId;

    try {
      const data = await api("/api/search", {
        method: "POST",
        body: { query: userMessage, conversationId: conversationId || undefined }
      });

      savedId = data.conversationId || conversationId;

      reply = {
        type: "ai",
        text:
          data.reply ||
          (data.count > 0
            ? `I found ${data.count} product${data.count > 1 ? "s" : ""} for you.`
            : "Sorry, I couldn't find a matching product."),
        products: data.results || []
      };
    } catch (error) {
      console.error(error);

      reply = {
        type: "ai",
        error: true,
        text: error.message || "Unable to connect to SmartBuy AI.",
        products: []
      };
    }

    setChat({
      id: savedId,
      messages: [...history, { type: "user", text: userMessage }, reply],
      error: ""
    });

    // A new saved chat gets its own URL.
    if (savedId && savedId !== conversationId) {
      navigate(`/chatbot/${savedId}`, { replace: true });
    }

    refreshChats();
    setLoading(false);
    inputRef.current?.focus();
  };

  // Questions sent from the Home page arrive as ?q=... (asked once signed in).
  useEffect(() => {
    const question = searchParams.get("q");

    if (user && question && !askedFromUrl.current) {
      askedFromUrl.current = true;
      setSearchParams({}, { replace: true });
      searchProducts(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const newChat = () => {
    if (loading) return;

    setChat({ id: null, messages: [], error: "" });
    setMessage("");
    setSidebarOpen(false);
    navigate("/chatbot");
    inputRef.current?.focus();
  };

  const openChat = (id) => {
    setSidebarOpen(false);

    if (id !== currentId) {
      navigate(`/chatbot/${id}`);
    }
  };

  const deleteChat = async (id) => {
    try {
      await api(`/api/chats/${id}`, { method: "DELETE" });
    } catch (error) {
      console.error(error);
    }

    setChats((prev) => prev?.filter((item) => item.id !== id) ?? prev);

    if (id === currentId) {
      newChat();
    }
  };

  if (checking) {
    return <Navbar />;
  }

  // The assistant is for signed-in users: every chat is saved to history.
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);

    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const showWelcome =
    !loadingChat && messages.length === 0 && !loading && !chat.error;

  return (
    <>
      <Navbar />

      <main className="chat-page">
        <div className="chat-shell">
          <ChatSidebar
            chats={chats}
            activeId={currentId}
            open={sidebarOpen}
            disabled={loading}
            onClose={() => setSidebarOpen(false)}
            onNew={newChat}
            onOpen={openChat}
            onDelete={deleteChat}
          />

          <section className="chat-main">
            <div className="chat-messages">
              {loadingChat && (
                <div className="chat-loading" aria-label="Loading chat">
                  <div className="skeleton" style={{ height: 40, width: "45%", marginLeft: "auto" }} />
                  <div className="skeleton" style={{ height: 64, width: "70%" }} />
                  <div className="skeleton" style={{ height: 150, width: "100%" }} />
                </div>
              )}

              {chat.error && chat.id === currentId && (
                <div className="chat-welcome">
                  <h2>Chat not available</h2>
                  <p>{chat.error}</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={newChat}
                  >
                    Start a new chat
                  </button>
                </div>
              )}

              {showWelcome && (
                <div className="chat-welcome">
                  <span className="welcome-icon">
                    <Sparkles size={26} />
                  </span>

                  <h2>What are you shopping for?</h2>

                  <p>
                    Describe the product, your budget and anything that
                    matters to you. I'll pick the best options and compare
                    prices across stores.
                  </p>

                  <div className="welcome-suggestions">
                    {suggestions.map(({ icon: Icon, text }) => (
                      <button
                        key={text}
                        type="button"
                        onClick={() => searchProducts(text)}
                      >
                        <Icon size={18} />
                        {text}
                      </button>
                    ))}
                  </div>

                </div>
              )}

              {messages.map((msg, index) =>
                msg.type === "user" ? (
                  <div key={index} className="msg msg-user">
                    <div className="msg-bubble">{msg.text}</div>
                  </div>
                ) : (
                  <div key={index} className="msg msg-ai">
                    <span className="msg-avatar">
                      <Bot size={16} />
                    </span>

                    <div className="msg-content">
                      <div
                        className={
                          msg.error ? "msg-bubble msg-error" : "msg-bubble"
                        }
                      >
                        {msg.text}
                      </div>

                      {msg.products?.length > 0 && (
                        <div className="msg-products">
                          {msg.products.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              layout="row"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {loading && (
                <div className="msg msg-ai">
                  <span className="msg-avatar">
                    <Bot size={16} />
                  </span>

                  <div className="msg-bubble typing">
                    <span className="typing-dots">
                      <i />
                      <i />
                      <i />
                    </span>
                    {loadingSteps[loadingStep].text}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <form
              className="chat-composer"
              onSubmit={(e) => {
                e.preventDefault();
                searchProducts(message);
              }}
            >
              <button
                type="button"
                className="icon-btn composer-icon composer-history"
                onClick={() => setSidebarOpen(true)}
                aria-label="Chat history"
                title="Chat history"
              >
                <History size={18} />
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  className="icon-btn composer-icon"
                  onClick={newChat}
                  disabled={loading}
                  aria-label="New chat"
                  title="New chat"
                >
                  <SquarePen size={18} />
                </button>
              )}

              <input
                ref={inputRef}
                type="text"
                value={message}
                placeholder="e.g. Gaming laptop under ₹80,000 with RTX graphics"
                onChange={(e) => setMessage(e.target.value)}
                disabled={loading || loadingChat}
                maxLength={200}
                autoFocus
              />

              <button
                type="submit"
                className="btn btn-primary composer-send"
                disabled={loading || loadingChat || !message.trim()}
                aria-label="Send"
              >
                <SendHorizontal size={18} />
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

export default Chatbot;
