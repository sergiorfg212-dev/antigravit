import { useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check } from "lucide-react";

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onClear: () => void;
}

export function SignaturePad({ onSave, onClear }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    onClear();
  };

  const save = () => {
    if (sigCanvas.current?.isEmpty()) return;
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
    if (dataUrl) onSave(dataUrl);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-white">
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            className: "signature-canvas w-full h-40",
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear}>
          <RotateCcw className="w-4 h-4 mr-2" /> Limpiar
        </Button>
        <Button size="sm" className="bg-green-600" onClick={save}>
          <Check className="w-4 h-4 mr-2" /> Confirmar Firma
        </Button>
      </div>
    </div>
  );
}
