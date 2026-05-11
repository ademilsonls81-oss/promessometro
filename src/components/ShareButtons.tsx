import React from "react";

interface ShareData {
  title: string;
  text: string;
  url: string;
  politician?: string;
  status?: string;
  score?: number;
}

const statusLabels: Record<string, string> = {
  cumprida: "Cumprida",
  parcialmente_cumprida: "Parcialmente Cumprida",
  em_andamento: "Em Andamento",
  nao_iniciada: "Não Iniciada",
  descumprida: "Descumprida",
  nao_classificada: "Não Classificada"
};

function buildShareText(data: ShareData): string {
  const statusText = data.status ? statusLabels[data.status] || data.status : "";
  const scoreText = data.score !== undefined ? ` (${data.score}/100)` : "";
  if (data.title) {
    return `${data.politician ? `${data.politician} prometeu` : "Sabia que"} "${data.title}" — ${statusText}${scoreText}. Acompanhe no Promessômetro 👉 ${data.url}`;
  }
  return `Acompanhe as promessas políticas no Promessômetro 👉 ${data.url}`;
}

export async function nativeShare(data: ShareData): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title || "Promessômetro",
        text: buildShareText(data),
        url: data.url
      });
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") return false;
      console.warn("[Share] Native share failed:", err);
    }
  }
  return false;
}

export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const result = document.execCommand("copy");
    document.body.removeChild(ta);
    return result;
  });
}

export function shareWhatsApp(text: string, url: string) {
  const full = `${text}\n\n${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(full)}`, "_blank", "noopener,noreferrer");
}

export function shareTwitter(text: string, url: string) {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
}

export function shareTelegram(text: string, url: string) {
  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function shareFacebook(url: string) {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
}

interface ShareButtonsProps {
  data: ShareData;
  compact?: boolean;
  onCopySuccess?: () => void;
}

export function ShareButtons({ data, compact = false, onCopySuccess }: ShareButtonsProps) {
  const [copied, setCopied] = React.useState(false);
  const [showNative, setShowNative] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);
  const text = buildShareText(data);

  const handleNative = async () => {
    const success = await nativeShare({ ...data, text });
    if (!success && !navigator.share) {
      setShowMore(true);
    }
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(`${text}\n\n${data.url}`);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopySuccess?.();
    }
  };

  const btnClass = "flex items-center justify-center rounded-xl transition-all active:scale-95 min-h-[48px] min-w-[48px]";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {navigator.share && (
        <button
          onClick={handleNative}
          className={`${btnClass} bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 border border-neon-cyan/30`}
          title="Compartilhar"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
          </svg>
        </button>
      )}

      <button
        onClick={() => shareWhatsApp(text, data.url)}
        className={`${btnClass} bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30`}
        title="WhatsApp"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>

      <button
        onClick={() => shareTwitter(text, data.url)}
        className={`${btnClass} bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/30`}
        title="X (Twitter)"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </button>

      {showMore || compact === false ? (
        <>
          <button
            onClick={() => shareTelegram(text, data.url)}
            className={`${btnClass} bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30`}
            title="Telegram"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
          </button>

          <button
            onClick={() => shareFacebook(data.url)}
            className={`${btnClass} bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30`}
            title="Facebook"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </button>
        </>
      ) : null}

      <button
        onClick={handleCopy}
        className={`${btnClass} ${copied ? "bg-green-500/30 border-green-500/30 text-green-400" : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-400"} transition-all`}
        title={copied ? "Copiado!" : "Copiar link"}
      >
        {copied ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default { nativeShare, copyToClipboard, shareWhatsApp, shareTwitter, shareTelegram, shareFacebook, ShareButtons };