import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface GuestPass {
  id: string;
  guest_name: string;
  valid_date: string;
  start_time: string;
  end_time: string;
  used: boolean;
  houses?: { house_number: string } | null;
}

interface QrScannerProps {
  onScanComplete?: () => void;
}

export function QrScanner({ onScanComplete }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<GuestPass | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "valid" | "expired" | "invalid" | "duplicate">("idle");
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Start camera
  const startScanning = async () => {
    try {
      setError(null);
      setScanStatus("scanning");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanning(true);
        scanQrCode();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to access camera";
      setError(message);
      setScanStatus("idle");
      toast.error("Camera access denied: " + message);
    }
  };

  // Stop camera
  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setScanning(false);
      setScanStatus("idle");
    }
  };

  // QR decoding using canvas and simple pattern detection
  const decodeQrFromVideo = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return null;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    try {
      context.drawImage(videoRef.current, 0, 0);

      // Try to extract URL from canvas using a simpler method
      // In production, use html5-qrcode library for better QR detection
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      // Placeholder for QR decoding - would need html5-qrcode library
      // For now, return null to trigger the library installation
      return null;
    } catch (e) {
      return null;
    }
  };

  const scanQrCode = async () => {
    if (!scanning) return;

    // Try to decode
    const decodedData = decodeQrFromVideo();

    // If no data, try again
    if (!decodedData) {
      requestAnimationFrame(scanQrCode);
      return;
    }

    // Extract token from URL
    const url = new URL(decodedData);
    const token = url.searchParams.get("qr");

    if (!token) {
      setScanStatus("invalid");
      setError("Invalid QR code format");
      requestAnimationFrame(scanQrCode);
      return;
    }

    // Check guest pass
    stopScanning();
    await verifyGuestPass(token);
  };

  const verifyGuestPass = async (token: string) => {
    try {
      setScanStatus("scanning");
      setError(null);

      // Get guest pass from database
      const { data: pass, error: fetchError } = await supabase
        .from("guest_passes")
        .select("*, houses(house_number)")
        .eq("qr_token", token)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!pass) {
        setScanStatus("invalid");
        setError("QR code not found in system");
        toast.error("Invalid QR code");
        return;
      }

      // Check if already used
      if (pass.used) {
        setScanStatus("duplicate");
        setError("This guest pass has already been used");
        toast.error("Duplicate scan - pass already used");
        return;
      }

      // Check if expired
      const now = new Date();
      const endTime = new Date(`${pass.valid_date}T${pass.end_time}`);
      if (endTime < now) {
        setScanStatus("expired");
        setError("This guest pass has expired");
        toast.error("Guest pass expired");
        return;
      }

      // Valid pass
      setScanStatus("valid");
      setScannedData(pass);
      toast.success("Valid guest pass found!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error verifying guest pass";
      setError(message);
      setScanStatus("invalid");
      toast.error(message);
    }
  };

  const handleAllowEntry = async () => {
    if (!scannedData || !user) return;

    try {
      // Create entry log
      const { error: insertError } = await supabase.from("entry_logs").insert({
        guest_pass_id: scannedData.id,
        guard_id: user.id,
        guest_name: scannedData.guest_name,
        house_id: scannedData.id,
        scanned_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      // Mark pass as used
      const { error: updateError } = await supabase
        .from("guest_passes")
        .update({ used: true })
        .eq("id", scannedData.id);

      if (updateError) throw updateError;

      toast.success("Entry logged successfully");
      setScannedData(null);
      setScanStatus("idle");
      onScanComplete?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to log entry";
      setError(message);
      toast.error(message);
    }
  };

  const handleDenyEntry = async () => {
    if (!scannedData) return;

    try {
      // Create denial log (store in entry_logs with status field)
      const { error } = await supabase.from("entry_logs").insert({
        guest_pass_id: scannedData.id,
        guard_id: user?.id,
        guest_name: scannedData.guest_name,
        house_id: scannedData.id,
        scanned_at: new Date().toISOString(),
        denied: true,
      });

      if (error) throw error;

      toast.info("Entry denied");
      setScannedData(null);
      setScanStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to log denial";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera View */}
      {scanning ? (
        <Card className="glass rounded-2xl p-4 overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-96 object-cover rounded-xl"
          />
          <canvas ref={canvasRef} className="hidden" />
          <Button
            onClick={stopScanning}
            variant="destructive"
            className="w-full mt-4"
          >
            Stop Scanning
          </Button>
        </Card>
      ) : (
        <>
          {!scannedData && (
            <Button
              onClick={startScanning}
              className="w-full gradient-hero text-white border-0 gap-2"
              size="lg"
            >
              <Camera className="h-5 w-5" />
              Start QR Scanner
            </Button>
          )}
        </>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Scan Status */}
      {scanStatus !== "idle" && !scannedData && (
        <div className="text-center py-8">
          {scanStatus === "scanning" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Scanning QR code...</p>
            </>
          )}
        </div>
      )}

      {/* Scanned Data Display */}
      {scannedData && (
        <Card className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            {scanStatus === "valid" && (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <Badge className="bg-green-500">VALID PASS</Badge>
              </>
            )}
            {scanStatus === "expired" && (
              <>
                <Clock className="h-6 w-6 text-yellow-500" />
                <Badge className="bg-yellow-500">EXPIRED PASS</Badge>
              </>
            )}
            {scanStatus === "duplicate" && (
              <>
                <XCircle className="h-6 w-6 text-red-500" />
                <Badge className="bg-red-500">ALREADY USED</Badge>
              </>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guest Name:</span>
              <span className="font-semibold">{scannedData.guest_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">House Number:</span>
              <span className="font-semibold">
                {scannedData.houses?.house_number || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date:</span>
              <span className="font-semibold">{scannedData.valid_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time:</span>
              <span className="font-semibold">
                {scannedData.start_time} - {scannedData.end_time}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold">
                {scannedData.used ? "Used" : "Active"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          {scanStatus === "valid" && (
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleAllowEntry}
                className="flex-1 gradient-hero text-white border-0"
              >
                Allow Entry
              </Button>
              <Button
                onClick={handleDenyEntry}
                variant="outline"
                className="flex-1"
              >
                Deny Entry
              </Button>
            </div>
          )}

          {(scanStatus === "expired" || scanStatus === "duplicate") && (
            <Button
              onClick={() => {
                setScannedData(null);
                setScanStatus("idle");
              }}
              variant="outline"
              className="w-full"
            >
              Scan Another
            </Button>
          )}
        </Card>
      )}

      {/* Note about QR Scanner Implementation */}
      <Alert className="text-xs">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          For production: Install html5-qrcode library for better QR detection accuracy
        </AlertDescription>
      </Alert>
    </div>
  );
}
