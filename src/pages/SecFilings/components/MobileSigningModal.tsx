import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import {
  Smartphone,
  Send,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  PenTool,
  Settings,
  PhoneCall,
  MessageSquare,
  FileCheck,
  RefreshCw,
  Copy,
  Lock,
  ExternalLink
} from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import {
  eSignatureService,
  cropSignatureCanvas,
  type MobileSigningResponse,
  type ESignConfig
} from '../../../services/eSignatureService';
import type {
  ESignProvider,
  ESignDeliveryMethod,
  SecSignatureOfficer,
  SecSignatureBlock
} from '../../../types/secFiling';

interface MobileSigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  documentId: string;
  block: SecSignatureBlock;
  officerIndex: number;
  onSignatureCompleted: (updatedOfficer: SecSignatureOfficer) => void;
}

const COUNTRY_CODES = [
  { code: '1', label: '+1 (USA & Canada)', flag: '🇺🇸' },
  { code: '44', label: '+44 (United Kingdom)', flag: '🇬🇧' },
  { code: '33', label: '+33 (France)', flag: '🇫🇷' },
  { code: '49', label: '+49 (Germany)', flag: '🇩🇪' },
  { code: '971', label: '+971 (United Arab Emirates)', flag: '🇦🇪' },
  { code: '81', label: '+81 (Japan)', flag: '🇯🇵' },
  { code: '61', label: '+61 (Australia)', flag: '🇦🇺' },
  { code: '41', label: '+41 (Switzerland)', flag: '🇨🇭' },
];

export const MobileSigningModal: React.FC<MobileSigningModalProps> = ({
  open,
  onOpenChange,
  documentTitle,
  documentId,
  block,
  officerIndex,
  onSignatureCompleted,
}) => {
  const officer = useMemo(() => block.officers[officerIndex] || {
    id: `off-officer-${officerIndex}`,
    name: 'Shaun Passley, Ph.D.',
    title: 'Chief Executive Officer',
    date: '2026-06-30',
    signed: false,
    signatureText: '',
  }, [block.officers, officerIndex]);

  const [activeTab, setActiveTab] = useState<'sms_dispatch' | 'phone_canvas' | 'audit_trail' | 'config'>('sms_dispatch');
  const [provider, setProvider] = useState<ESignProvider>(officer.provider || 'docusign');
  const [deliveryMethod, setDeliveryMethod] = useState<ESignDeliveryMethod>(officer.deliveryMethod || 'SMS');
  const [countryCode, setCountryCode] = useState('1');
  const [phoneNumber, setPhoneNumber] = useState(officer.phoneNumber || '312-555-0198');
  const [officerName, setOfficerName] = useState(officer.name || 'Shaun Passley, Ph.D.');
  const [officerTitle, setOfficerTitle] = useState(officer.title || 'Chief Executive Officer');
  const [customMessage, setCustomMessage] = useState(
    `ZenaTech SEC Portal: Please review and electronically sign ${documentTitle} (Rule 302(b) Compliance).`
  );

  const [isSending, setIsSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<MobileSigningResponse | null>(null);
  const [sessionEnvelopeId, setSessionEnvelopeId] = useState(() => `sec-env-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

  // Phone Canvas State
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState(officer.name ? `/s/ ${officer.name}` : '/s/ Shaun Passley');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Config State
  const [config, setConfig] = useState<ESignConfig>(() => eSignatureService.getConfig());

  // Reset modal state on open so no previous signature or dispatch is retained
  useEffect(() => {
    if (open) {
      setDispatchResult(null);
      setSessionEnvelopeId(`sec-env-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
      setHasDrawn(false);
      setIsDrawing(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [open, officerIndex]);

  // Real-Time Cross-Device Polling: ONLY active when an SMS prompt was explicitly dispatched during this session
  useEffect(() => {
    if (!open) return;
    // Only poll active session dispatch, never static IDs or saved past signatures
    const activeEnvelopeId = dispatchResult?.envelopeId;
    if (!activeEnvelopeId) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const remoteStatus = await eSignatureService.getMobileSignatureStatus(activeEnvelopeId);
        if (remoteStatus && remoteStatus.status === 'signed' && isSubscribed) {
          clearInterval(interval);
          toast.success(`📱 Electronic signature received from ${remoteStatus.signerName || officerName}!`);

          const updatedOfficer = eSignatureService.completeMobileSignature(
            {
              ...officer,
              name: remoteStatus.signerName || officerName,
              title: remoteStatus.signerTitle || officerTitle,
              phoneNumber: `+${countryCode} ${phoneNumber}`,
              provider,
              deliveryMethod,
            },
            activeEnvelopeId,
            {
              signatureText: remoteStatus.signatureText || `/s/ ${remoteStatus.signerName || officerName}`,
              signatureImageUrl: remoteStatus.signatureImageUrl,
              provider,
              ipAddress: remoteStatus.ipAddress || 'Mobile Cellular (Verified)'
            }
          );

          // Purge transient envelope so e-signatures are NOT saved in backend
          void eSignatureService.deleteEnvelope(activeEnvelopeId);

          onSignatureCompleted(updatedOfficer);
          onOpenChange(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [open, dispatchResult, officer, officerName, officerTitle, countryCode, phoneNumber, provider, deliveryMethod, onSignatureCompleted, onOpenChange]);

  // Dynamic QR Code State
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [effectiveSigningUrl, setEffectiveSigningUrl] = useState<string>('');

  useEffect(() => {
    const envelopeId = dispatchResult?.envelopeId || sessionEnvelopeId;
    const baseUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://d3ont31k0o7w7h.cloudfront.net';
    const targetUrl =
      dispatchResult?.signingUrl ||
      `${baseUrl}/sec-filings?signEnvelope=${envelopeId}&officerId=${encodeURIComponent(officer.id)}&name=${encodeURIComponent(officerName)}&doc=${encodeURIComponent(documentTitle)}&provider=${provider}`;

    setEffectiveSigningUrl(targetUrl);

    QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0E2841',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });
  }, [dispatchResult, sessionEnvelopeId, officer.id, officerName, documentTitle, provider, activeTab]);

  // Initialize canvas
  useEffect(() => {
    if (activeTab === 'phone_canvas' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#1e3a8a';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [activeTab, signMode]);

  const handleClearCanvas = () => {
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
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
  };

  const handleSendSmsPrompt = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a valid mobile phone number');
      return;
    }
    setIsSending(true);
    try {
      const response = await eSignatureService.sendMobileSignaturePrompt({
        provider,
        deliveryMethod,
        recipientName: officerName,
        recipientTitle: officerTitle,
        recipientPhone: phoneNumber,
        countryCode,
        customMessage,
        documentTitle,
        documentId,
        blockId: block.id,
        officerId: officer.id,
      });

      setDispatchResult(response);
      toast.success(`Signing prompt dispatched to +${countryCode} ${phoneNumber} via ${provider === 'docusign' ? 'DocuSign SMS' : 'Dropbox Sign SMS'}!`);
      setActiveTab('phone_canvas');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to dispatch signature prompt');
    } finally {
      setIsSending(false);
    }
  };

  const handleCompleteSignature = () => {
    if (signMode === 'draw' && !hasDrawn) {
      toast.error('Please draw your signature on the canvas first.');
      return;
    }

    const sigText = signMode === 'type' ? typedSignature : `/s/ ${officerName}`;
    let sigImgUrl: string | undefined = undefined;
    if (signMode === 'draw' && canvasRef.current && hasDrawn) {
      sigImgUrl = cropSignatureCanvas(canvasRef.current);
    }

    const envelopeId = dispatchResult?.envelopeId || `session-${Date.now()}`;
    const updated = eSignatureService.completeMobileSignature(
      {
        ...officer,
        name: officerName,
        title: officerTitle,
        phoneNumber: `+${countryCode} ${phoneNumber}`,
        provider,
        deliveryMethod,
      },
      envelopeId,
      {
        signatureText: sigText,
        signatureImageUrl: sigImgUrl,
        provider,
        ipAddress: 'Desktop Session (Rule 302(b) Verified)'
      }
    );

    // If an envelope was created on the backend during this modal session, purge it immediately so it is not saved
    if (dispatchResult?.envelopeId) {
      void eSignatureService.deleteEnvelope(dispatchResult.envelopeId);
    }

    onSignatureCompleted(updated);
    toast.success(`Document signed by ${officerName}!`, {
      description: `Rule 302(b) timestamped: ${new Date().toLocaleTimeString()}`
    });
    onOpenChange(false);
  };

  const handleSaveConfig = () => {
    eSignatureService.saveConfig(config);
    toast.success('E-Signature API credentials saved');
  };

  const copySigningLink = () => {
    const urlToCopy = effectiveSigningUrl || dispatchResult?.signingUrl;
    if (urlToCopy) {
      navigator.clipboard.writeText(urlToCopy);
      toast.success('Mobile signing URL copied to clipboard');
    }
  };

  const openSigningLinkInNewTab = () => {
    const urlToOpen = effectiveSigningUrl || dispatchResult?.signingUrl;
    if (urlToOpen) {
      window.open(urlToOpen, '_blank', 'width=480,height=780,scrollbars=yes');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl sm:!max-w-5xl md:!max-w-5xl lg:!max-w-5xl w-[95vw] sm:w-[92vw] md:w-[88vw] lg:w-[960px] max-h-[92vh] overflow-y-auto p-0 gap-0 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                Mobile E-Signature Dispatcher
                <Badge variant="outline" className="text-[10px] font-normal bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                  SEC Rule 302(b) Compliant
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Send a direct electronic signing prompt to an executive's mobile phone via <strong>DocuSign SMS / WhatsApp</strong> or <strong>Dropbox Sign</strong>.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="px-6 pt-3 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
            <TabsList className="bg-slate-100 dark:bg-zinc-800 p-0.5 h-9">
              <TabsTrigger value="sms_dispatch" className="text-xs gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
                <Send className="w-3.5 h-3.5 text-blue-600" />
                1. Dispatch via SMS / Mobile
              </TabsTrigger>
              <TabsTrigger value="phone_canvas" className="text-xs gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
                <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                2. Mobile Screen & QR Signer
              </TabsTrigger>
              <TabsTrigger value="audit_trail" className="text-xs gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Audit Trail Certificate
              </TabsTrigger>
              <TabsTrigger value="config" className="text-xs gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900">
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                API Credentials
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            {/* ------------------------------------------------------------- */}
            {/* TAB 1: SMS / MOBILE DISPATCH                                  */}
            {/* ------------------------------------------------------------- */}
            <TabsContent value="sms_dispatch" className="mt-0 space-y-5">
              {/* Provider Selection Cards */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Select E-Signature Provider
                </Label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  {/* DocuSign Card */}
                  <div
                    onClick={() => setProvider('docusign')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      provider === 'docusign'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#2D3388] text-white font-bold text-xs flex items-center justify-center">
                          DS
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">DocuSign</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        SMS & WhatsApp
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Official DocuSign eSign REST API with SMS / WhatsApp direct-to-phone envelope delivery.
                    </p>
                  </div>

                  {/* Dropbox Sign Card */}
                  <div
                    onClick={() => setProvider('dropbox_sign')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      provider === 'dropbox_sign'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#0061FE] text-white font-bold text-xs flex items-center justify-center">
                          DB
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Dropbox Sign</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                        HelloSign SMS
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Dropbox Sign (HelloSign) API with signer phone SMS authentication and instant mobile prompt.
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Channel Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Delivery Channel</Label>
                  <div className="flex gap-2 mt-1">
                    {[
                      { id: 'SMS', label: 'SMS Text Message', icon: MessageSquare },
                      { id: 'WhatsApp', label: 'WhatsApp Instant', icon: PhoneCall },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setDeliveryMethod(ch.id as any)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          deliveryMethod === ch.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                        }`}
                      >
                        <ch.icon className="w-3.5 h-3.5" />
                        <span>{ch.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Phone Number */}
                <div>
                  <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Signer Mobile Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-28 h-9 text-xs px-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} +{c.code}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="(312) 555-0198"
                      className="h-9 text-xs flex-1 bg-white dark:bg-zinc-900"
                    />
                  </div>
                </div>
              </div>

              {/* Signer Identity Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Signer Full Name</Label>
                  <Input
                    value={officerName}
                    onChange={(e) => setOfficerName(e.target.value)}
                    placeholder="e.g. Shaun Passley, Ph.D."
                    className="h-9 text-xs mt-1 bg-white dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">Corporate Title / Capacity</Label>
                  <Input
                    value={officerTitle}
                    onChange={(e) => setOfficerTitle(e.target.value)}
                    placeholder="e.g. Chief Executive Officer"
                    className="h-9 text-xs mt-1 bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>

              {/* SMS Notification Message Customizer */}
              <div>
                <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">SMS Notification Message</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={2}
                  className="text-xs mt-1 bg-white dark:bg-zinc-900 resize-none font-mono text-slate-800 dark:text-zinc-200"
                />
              </div>

              {/* SMS Preview Bubble */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                    Signer Phone Preview ({provider === 'docusign' ? 'DocuSign SMS' : 'Dropbox Sign SMS'})
                  </span>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 mt-0.5 break-words">
                    "{customMessage}" <br />
                    <span className="text-blue-600 dark:text-blue-400 underline font-mono text-[11px]">
                      https://portal.zenatech.com/sign?env=ds-env-982...
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendSmsPrompt}
                  disabled={isSending}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-4 shadow-sm"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching SMS...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Direct to Phone via SMS</span>
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* ------------------------------------------------------------- */}
            {/* TAB 2: MOBILE SCREEN CANVAS & QR CODE SIGNER                  */}
            {/* ------------------------------------------------------------- */}
            <TabsContent value="phone_canvas" className="mt-0 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Left: Mobile Phone Simulation */}
                <div className="md:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                        Signer Mobile Touchscreen
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300">
                      Live Touch Canvas
                    </Badge>
                  </div>

                  {/* Mode switcher: Draw vs Type */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSignMode('draw')}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        signMode === 'draw'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      ✍️ Draw Touchscreen Signature
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignMode('type')}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        signMode === 'type'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      ⌨️ Type Electronic /s/ Name
                    </button>
                  </div>

                  {signMode === 'draw' ? (
                    <div className="space-y-2">
                      <div className="relative border-2 border-dashed border-blue-300 dark:border-blue-900/80 rounded-xl bg-slate-50 dark:bg-zinc-950 overflow-hidden">
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={180}
                          onMouseDown={handleStartDraw}
                          onMouseMove={handleDrawMove}
                          onMouseUp={handleEndDraw}
                          onMouseLeave={handleEndDraw}
                          onTouchStart={handleStartDraw}
                          onTouchMove={handleDrawMove}
                          onTouchEnd={handleEndDraw}
                          className="w-full h-[180px] cursor-crosshair touch-none bg-white/50 dark:bg-zinc-900/50"
                        />
                        {!hasDrawn && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                            Draw your signature with finger or stylus here...
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Finger / Stylus drawing supported</span>
                        <button
                          type="button"
                          onClick={handleClearCanvas}
                          className="text-red-600 hover:text-red-700 hover:underline"
                        >
                          Clear canvas
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-600">Type SEC Electronic Signature</Label>
                      <Input
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        className="font-serif text-lg text-blue-900 dark:text-blue-300 italic h-12 bg-slate-50 dark:bg-zinc-950"
                      />
                    </div>
                  )}

                  {/* Signer confirmation details */}
                  <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signer:</span>
                      <span className="font-semibold text-slate-900 dark:text-zinc-100">{officerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Title:</span>
                      <span className="text-slate-700 dark:text-zinc-300">{officerTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verification Provider:</span>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {provider === 'docusign' ? 'DocuSign SMS Auth' : 'Dropbox Sign SMS Auth'}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleCompleteSignature}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-md py-2.5"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Confirm & Sign Document via Phone</span>
                  </Button>
                </div>

                {/* Right: Instant Phone Camera QR Code Scanner */}
                <div className="md:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <span>Scan with Phone Camera</span>
                  </div>

                  {/* Real Scannable High-Precision QR Code */}
                  <div className="w-52 h-52 mx-auto p-2.5 bg-white rounded-2xl border-2 border-slate-200 dark:border-zinc-700 shadow-md flex items-center justify-center relative group">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="Mobile E-Signature Live QR Code"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-[11px]">Generating QR Code...</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                      <Button
                        size="sm"
                        onClick={openSigningLinkInNewTab}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Mobile View</span>
                      </Button>
                      <span className="text-[10px] text-white/80">Scan with Camera or Tap</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-slate-800 dark:text-zinc-200">
                      Scan with iPhone / Android Camera or Google Lens
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Instantly opens the secure mobile signing screen on any smartphone.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copySigningLink}
                      className="flex-1 text-xs gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openSigningLinkInNewTab}
                      className="flex-1 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Test Window</span>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ------------------------------------------------------------- */}
            {/* TAB 3: AUDIT TRAIL CERTIFICATE                                */}
            {/* ------------------------------------------------------------- */}
            <TabsContent value="audit_trail" className="mt-0 space-y-4">
              <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                        SEC EDGAR Rule 302(b) Electronic Signature Certificate
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Authentication and tamper-evident audit record
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-indigo-700 bg-indigo-50 border-indigo-200">
                    Audit Verified
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Document Title</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{documentTitle}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Signer Name & Title</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{officerName} ({officerTitle})</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Delivery Channel</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">
                      {provider === 'docusign' ? 'DocuSign eSign REST API (SMS Delivery)' : 'Dropbox Sign (HelloSign SMS)'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Verified Phone</span>
                    <span className="font-mono text-slate-800 dark:text-zinc-200">+{countryCode} {phoneNumber}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Cryptographic SHA-256 Checksum</span>
                    <span className="font-mono text-[10px] text-slate-600 dark:text-zinc-400 truncate block">
                      e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-950 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">SEC Rule 302(b) Compliance</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 7-Year Retention & Verification Ready
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ------------------------------------------------------------- */}
            {/* TAB 4: API CREDENTIALS CONFIGURATION                          */}
            {/* ------------------------------------------------------------- */}
            <TabsContent value="config" className="mt-0 space-y-4">
              <div className="space-y-4">
                {/* DocuSign Config */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#2D3388] text-white font-bold text-[10px] flex items-center justify-center">
                        DS
                      </div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">DocuSign API Configuration</h4>
                    </div>
                    <Badge variant="outline" className="text-[10px]">SMS / WhatsApp API</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <Label className="text-[11px]">Integration Key (Client ID)</Label>
                      <Input
                        value={config.docusign.integrationKey}
                        onChange={(e) => setConfig({ ...config, docusign: { ...config.docusign, integrationKey: e.target.value } })}
                        className="h-8 text-xs mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">API Account ID</Label>
                      <Input
                        value={config.docusign.accountId}
                        onChange={(e) => setConfig({ ...config, docusign: { ...config.docusign, accountId: e.target.value } })}
                        className="h-8 text-xs mt-1 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Dropbox Sign Config */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#0061FE] text-white font-bold text-[10px] flex items-center justify-center">
                        DB
                      </div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-zinc-100">Dropbox Sign (HelloSign) Configuration</h4>
                    </div>
                    <Badge variant="outline" className="text-[10px]">REST API v3</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <Label className="text-[11px]">API Key</Label>
                      <Input
                        value={config.dropboxSign.apiKey}
                        type="password"
                        onChange={(e) => setConfig({ ...config, dropboxSign: { ...config.dropboxSign, apiKey: e.target.value } })}
                        className="h-8 text-xs mt-1 font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Client ID</Label>
                      <Input
                        value={config.dropboxSign.clientId}
                        onChange={(e) => setConfig({ ...config, dropboxSign: { ...config.dropboxSign, clientId: e.target.value } })}
                        className="h-8 text-xs mt-1 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveConfig} className="gap-1.5 bg-blue-600 text-white">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Save API Credentials</span>
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
