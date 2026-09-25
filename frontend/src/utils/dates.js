const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

// "Today", "Yesterday", "Previous 7 days", ... for the chat history sidebar.
export function chatGroup(value) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(value)) / DAY);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Older";
}

// Short label: time for today, otherwise a date.
export function formatChatDate(value) {
  const date = new Date(value);

  if (chatGroup(value) === "Today") {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });
}
