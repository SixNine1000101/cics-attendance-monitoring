import { QrScanner } from "@yudiel/react-qr-scanner";
import React, { useState } from "react";

export default function Scanner() {
  const [result, setResult] = useState("No result");

  return (
    <div>
      <h2>QR Scanner</h2>
      <QrScanner
        onDecode={(decodedText) => setResult(decodedText)}
        onError={(error) => console.error(error?.message)}
      />
      <p>Scanned: {result}</p>
    </div>
  );
}
