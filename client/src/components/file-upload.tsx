import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface FileUploadProps {
  bucket?: string;
  folder?: string;
  accept?: string;
  maxSizeMB?: number;
  onUploadComplete: (url: string) => void;
  onError?: (message: string) => void;
}

export function FileUpload({
  bucket = "verification-documents",
  folder = "docs",
  accept = ".pdf,.jpg,.jpeg,.png",
  maxSizeMB = 10,
  onUploadComplete,
  onError,
}: FileUploadProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      const msg = `File must be under ${maxSizeMB}MB`;
      setErrorMsg(msg);
      setStatus("error");
      onError?.(msg);
      return;
    }

    setFileName(file.name);
    setStatus("uploading");
    setProgress(10);

    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Simulate progress during upload
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 300);

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false });

      clearInterval(progressInterval);

      if (error) {
        setStatus("error");
        const msg = error.message || "Upload failed";
        setErrorMsg(msg);
        onError?.(msg);
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
      setProgress(100);
      setStatus("success");
      onUploadComplete(publicUrl);
    } catch (err) {
      clearInterval(progressInterval);
      const msg = "Upload failed. Please try again.";
      setStatus("error");
      setErrorMsg(msg);
      onError?.(msg);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStatus("idle");
    setProgress(0);
    setFileName(null);
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        status === "idle" ? "border-border hover:border-primary/50 cursor-pointer" :
        status === "success" ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" :
        status === "error" ? "border-destructive bg-destructive/5" :
        "border-primary/50 bg-primary/5"
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => status === "idle" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
      />

      {status === "idle" && (
        <div className="space-y-2">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">Drop file here or click to upload</p>
          <p className="text-xs text-muted-foreground">
            {accept.split(",").join(", ")} · Max {maxSizeMB}MB
          </p>
        </div>
      )}

      {status === "uploading" && (
        <div className="space-y-3">
          <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
          <p className="text-sm font-medium">{fileName}</p>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">Uploading... {progress}%</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-2">
          <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{fileName}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">Uploaded successfully</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 text-xs h-7"
            onClick={(e) => { e.stopPropagation(); reset(); }}
          >
            Upload different file
          </Button>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <XCircle className="h-8 w-8 mx-auto text-destructive" />
          <p className="text-sm font-medium text-destructive">{errorMsg}</p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 text-xs h-7"
            onClick={(e) => { e.stopPropagation(); reset(); }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
