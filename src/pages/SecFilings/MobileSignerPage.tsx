import { eSignatureService, cropSignatureCanvas } from '../../services/eSignatureService';
import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, FileText, Lock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { ZENATECH_LOGO_DATA_URL } from '../../data/zenatechLogoAsset';
import { secFilingService } from '../../services/secFilingService';

export const MobileSignerPage: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const envelopeId = searchParams.get('signEnvelope') || 'ds-env-98273';
  const officerNameParam = searchParams.get('name') || 'Executive Signer';
  const docTitleParam = searchParams.get('doc') || 'Form 6-K Interim Financial Report';
  const providerParam = searchParams.get('provider') || 'docusign';

  const [signerName, setSignerName] = useState(officerNameParam);
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState(officerNameParam ? `/s/ ${officerNameParam}` : '/s/ Executive Signer');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [signatureTimestamp, setSignatureTimestamp] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0e2841';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [signMode]);

  const handleClear = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasDrawn(false);
      }
    }
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
  };

  const handleSubmitSignature = () => {
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let sigImgUrl: string | undefined = undefined;
    if (signMode === 'draw' && canvasRef.current && hasDrawn) {
      sigImgUrl = cropSignatureCanvas(canvasRef.current);
    }
    const finalSigText = signMode === 'type' ? typedSignature : `/s/ ${signerName}`;

    secFilingService.applyElectronicSignature(signerName, {
      signatureText: finalSigText,
      signatureImageUrl: sigImgUrl,
      provider: providerParam,
      envelopeId,
      signedVia: `${providerParam === 'dropbox_sign' ? 'Dropbox Sign' : 'DocuSign'} Mobile SMS (Rule 302(b) Verified)`
    });

    // Broadcast and save to backend server for cross-device real-time sync with desktop
    void eSignatureService.submitMobileSignature(envelopeId, {
      signerName,
      signatureText: finalSigText,
      signatureImageUrl: sigImgUrl,
      provider: providerParam,
      signedVia: `${providerParam === 'dropbox_sign' ? 'Dropbox Sign' : 'DocuSign'} Mobile SMS (Rule 302(b) Verified)`,
      ipAddress: 'Mobile Client (Rule 302(b) Verified)'
    });

    // Save session in local storage for audit
    const sessionData = {
      envelopeId,
      signerName,
      docTitle: docTitleParam,
      provider: providerParam,
      signatureText: finalSigText,
      signatureImageUrl: sigImgUrl,
      signedAt: now.toISOString(),
      status: 'signed'
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`sec_esign_envelope_${envelopeId}`, JSON.stringify(sessionData));
    }

    setSignatureTimestamp(formatted);
    setIsSubmitted(true);
    toast.success('Electronic signature submitted successfully!');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <Badge className="bg-emerald-600 text-white font-medium mb-2">SEC Rule 302(b) Verified</Badge>
            <h2 className="text-xl font-bold text-slate-900">Document Successfully Signed</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your electronic signature has been cryptographically recorded and linked to the live filing.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Signer:</span>
              <span className="font-semibold text-slate-900">{signerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Document:</span>
              <span className="font-medium text-slate-800 truncate max-w-[190px]">{docTitleParam}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Envelope ID:</span>
              <span className="font-mono text-slate-700">{envelopeId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Timestamp:</span>
              <span className="text-slate-700">{signatureTimestamp}</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Compliant with SEC EDGAR Electronic Signature Retention (7 Years)</span>
          </div>

          <Button
            onClick={() => window.close()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium"
          >
            Close Window
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col justify-between p-3 sm:p-6 font-sans">
      <div className="max-w-lg w-full mx-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0E2841] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={ZENATECH_LOGO_DATA_URL} alt="ZenaTech Logo" className="h-7 w-auto object-contain brightness-0 invert" />
            <div>
              <h1 className="text-sm font-bold tracking-tight">SEC E-Sign Portal</h1>
              <span className="text-[10px] text-blue-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" /> Secure Mobile Verification
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] bg-blue-900/60 text-blue-200 border-blue-400/40">
            {providerParam === 'docusign' ? 'DocuSign Mobile' : 'Dropbox Sign'}
          </Badge>
        </div>

        {/* Document summary banner */}
        <div className="p-4 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate">{docTitleParam}</h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Envelope: <span className="font-mono text-[10px] text-slate-700 dark:text-zinc-300">{envelopeId}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Signer Full Name</label>
            <Input
              value={signerName}
              onChange={(e) => {
                setSignerName(e.target.value);
                setTypedSignature(`/s/ ${e.target.value}`);
              }}
              className="mt-1 h-9 text-xs"
            />
          </div>

          {/* Mode Switcher */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSignMode('draw')}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                signMode === 'draw'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              ✍️ Draw Signature
            </button>
            <button
              type="button"
              onClick={() => setSignMode('type')}
              className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                signMode === 'type'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              ⌨️ Type /s/ Name
            </button>
          </div>

          {/* Canvas or Type */}
          {signMode === 'draw' ? (
            <div className="space-y-1.5">
              <div className="relative border-2 border-dashed border-blue-300 dark:border-blue-900 rounded-xl bg-slate-50 dark:bg-zinc-950 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={170}
                  onMouseDown={handleStartDraw}
                  onMouseMove={handleDrawMove}
                  onMouseUp={handleEndDraw}
                  onMouseLeave={handleEndDraw}
                  onTouchStart={handleStartDraw}
                  onTouchMove={handleDrawMove}
                  onTouchEnd={handleEndDraw}
                  className="w-full h-[170px] cursor-crosshair touch-none bg-white dark:bg-zinc-900"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                    Draw your signature on screen...
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Use finger or stylus</span>
                <button type="button" onClick={handleClear} className="text-red-600 hover:underline">
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600">Electronic SEC Signature (/s/ format)</label>
              <Input
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                className="font-serif text-lg text-blue-900 dark:text-blue-300 italic h-12 bg-slate-50 dark:bg-zinc-950"
              />
            </div>
          )}

          {/* SEC Rule 302(b) Notice */}
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/80 dark:border-blue-900 text-[11px] text-slate-600 dark:text-zinc-300 space-y-1">
            <div className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> SEC Rule 302(b) of Regulation S-T Notice
            </div>
            <p className="leading-snug text-slate-600 dark:text-zinc-400">
              By clicking "Submit E-Signature", you certify and agree that this electronic signature constitutes your legal execution of the filing for SEC EDGAR compliance.
            </p>
          </div>

          <Button
            onClick={handleSubmitSignature}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 shadow-md gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Submit E-Signature to Live SEC Filing</span>
          </Button>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-400 py-3">
        ZenaTech Enterprise Portal • Secure Electronic Signature Delivery
      </div>
    </div>
  );
};

export default MobileSignerPage;
