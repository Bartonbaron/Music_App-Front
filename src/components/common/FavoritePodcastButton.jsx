import { useCallback, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { useLibrary } from "../../contexts/LibraryContext";
import { useAuth } from "../../contexts/AuthContext";

export default function FavoritePodcastButton({
                                                  podcastID,
                                                  size = 16,
                                                  onToast,
                                                  title,
                                                  style,
                                              }) {
    const { token } = useAuth();
    const { favoritePodcastIds, togglePodcastFavorite } = useLibrary();

    const [saving, setSaving] = useState(false);

    const normalizedId = useMemo(() => {
        if (podcastID === 0) return "0";
        if (!podcastID) return null;
        return String(podcastID);
    }, [podcastID]);

    const isFav = useMemo(() => {
        if (!normalizedId) return false;
        return !!favoritePodcastIds?.has(normalizedId);
    }, [favoritePodcastIds, normalizedId]);

    const disabled = !token || !normalizedId || !togglePodcastFavorite || saving;

    const handleClick = useCallback(async () => {
        if (disabled) {
            if (!token && onToast) onToast("Zaloguj się, aby dodać odcinek", "error");
            return;
        }

        setSaving(true);
        try {
            const result = await togglePodcastFavorite(normalizedId, isFav);

            if (result?.success) {
                onToast?.(isFav ? "Usunięto z Moich odcinków" : "Dodano do Moich odcinków", "success");
            } else {
                onToast?.(result?.message || "Błąd Moich odcinków", "error");
            }
        } catch (e) {
            onToast?.(e?.message || "Błąd Moich odcinków", "error");
        } finally {
            setSaving(false);
        }
    }, [disabled, token, togglePodcastFavorite, normalizedId, isFav, onToast]);

    return (
        <button
            onClick={(e) => {
                e.stopPropagation(); // ważne w kartach/wierszach, żeby nie odpalać play
                handleClick();
            }}
            disabled={disabled}
            title={
                title ||
                (disabled
                    ? "Niedostępne"
                    : isFav
                        ? "Usuń z Moich odcinków"
                        : "Dodaj do Moich odcinków")
            }
            style={{
                ...styles.btn,
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                color: isFav ? "#1db954" : "white",
                ...style,
            }}
            aria-pressed={isFav}
            aria-label={isFav ? "Usuń z Moich odcinków" : "Dodaj do Moich odcinków"}
            type="button"
        >
            <Heart
                size={size}
                style={{ display: "block" }}
                fill={isFav ? "currentColor" : "none"}
            />
        </button>
    );
}

const styles = {
    btn: {
        width: 38,
        height: 34,
        borderRadius: 10,
        border: "1px solid #333",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 0, // 🔑 przy globalnym svg.lucide { width: 1em; height: 1em; }
    },
};
