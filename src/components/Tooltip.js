import React, { useState } from "react";

function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
    return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full mb-2 w-max max-w-xs bg-gray-800 text-white text-sm rounded-md p-2 shadow-lg z-10">
          {text}
        </div>
        )}
    </div>
  );
}
export default Tooltip;  