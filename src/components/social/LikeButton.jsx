import { useCallback, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { useLibrary } from "../../contexts/LibraryContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

export default function LikeButton({
    songID,
    size = 16,
    onToast,
    title,
    style,
}) {
    const { token } = useAuth();
    const { likedSongIds, toggleSongLike } = useLibrary();

    const [saving, setSaving] = useState(false);

    const normalizedId = useMemo(() => {
        if (songID === 0) return "0";
        if (!songID) return null;
        return String(songID);
    }, [songID]);

    const isLiked = useMemo(() => {
        if (!normalizedId) return false;
        return !!likedSongIds?.has(normalizedId);
    }, [likedSongIds, normalizedId]);

    const disabled = !token || !normalizedId || !toggleSongLike || saving;

    const handleClick = useCallback(async () => {
        if (disabled) {
            if (!token && onToast) onToast("Zaloguj się, aby polubić utwór", "error");
            return;
        }

        setSaving(true);
        try {
            const result = await toggleSongLike(normalizedId, isLiked);

            if (result?.success) {
                onToast?.(isLiked ? "Usunięto z polubionych" : "Dodano do polubionych", "success");
            } else {
                onToast?.(result?.message || "Błąd polubień", "error");
            }
        } catch (e) {
            onToast?.(e?.message || "Błąd polubień", "error");
        } finally {
            setSaving(false);
        }
    }, [disabled, token, toggleSongLike, normalizedId, isLiked, onToast]);

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            title={
                title ||
                (disabled
                    ? "Polubienia niedostępne"
                    : isLiked
                        ? "Usuń z polubionych"
                        : "Dodaj do polubionych")
            }
            style={{
                ...styles.btn,
                opacity: disabled ? 0.45 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                color: isLiked ? "#1db954" : "white",
                ...style,
            }}
            aria-pressed={isLiked}
            aria-label={isLiked ? "Usuń z polubionych" : "Dodaj do polubionych"}
            type="button"
        >
            <Heart
                size={size}
                style={{ display: "block" }}
                fill={isLiked ? "currentColor" : "none"}
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
    },
};