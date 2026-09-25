import { useState } from "react";
import { Check, MessageSquare, SquarePen, Trash2, X } from "lucide-react";
import { chatGroup } from "../utils/dates";
import "./ChatSidebar.css";

const GROUP_ORDER = [
  "Today",
  "Yesterday",
  "Previous 7 days",
  "Previous 30 days",
  "Older"
];

function ChatSidebar({
  chats,
  activeId,
  open,
  disabled,
  onClose,
  onNew,
  onOpen,
  onDelete
}) {
  // Deleting takes two clicks: the bin icon turns into a confirm button.
  const [confirmId, setConfirmId] = useState(null);

  const groups = GROUP_ORDER.map((label) => ({
    label,
    items: (chats || []).filter((chat) => chatGroup(chat.updatedAt) === label)
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={open ? "chat-sidebar open" : "chat-sidebar"}>
        <div className="sidebar-top">
          <button
            type="button"
            className="btn btn-secondary sidebar-new"
            onClick={onNew}
            disabled={disabled}
          >
            <SquarePen size={16} /> New chat
          </button>

          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={onClose}
            aria-label="Close chat history"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-list" aria-label="Chat history">
          {chats === null &&
            Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="skeleton sidebar-skeleton"
                aria-hidden="true"
              />
            ))}

          {chats?.length === 0 && (
            <p className="sidebar-empty">
              Your chats will appear here.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.label} className="sidebar-group">
              <p className="sidebar-group-label">{group.label}</p>

              {group.items.map((chat) => (
                <div
                  key={chat.id}
                  className={
                    chat.id === activeId ? "sidebar-item active" : "sidebar-item"
                  }
                >
                  <button
                    type="button"
                    className="sidebar-open"
                    onClick={() => onOpen(chat.id)}
                    disabled={disabled}
                    title={chat.title}
                  >
                    <MessageSquare size={15} />
                    <span>{chat.title}</span>
                  </button>

                  {confirmId === chat.id ? (
                    <button
                      type="button"
                      className="sidebar-action sidebar-confirm"
                      onClick={() => {
                        setConfirmId(null);
                        onDelete(chat.id);
                      }}
                      onBlur={() => setConfirmId(null)}
                      aria-label="Confirm delete"
                      title="Click again to delete"
                      autoFocus
                    >
                      <Check size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="sidebar-action"
                      onClick={() => setConfirmId(chat.id)}
                      disabled={disabled}
                      aria-label={`Delete chat: ${chat.title}`}
                      title="Delete chat"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default ChatSidebar;
