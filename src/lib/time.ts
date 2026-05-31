// Shared time formatters used by the gallery grid, lightbox, and the
// time-scrollbar rail. `tim` is a Unix timestamp in milliseconds.

export function formatRelativeTime(tim: number): string {
    if (!tim) return '';
    const diff = Date.now() - tim;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}

export function formatExactTime(tim: number): string {
    if (!tim) return '';
    const d = new Date(tim);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    const tz = d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '';
    return `${mm}${dd}${yy} ${h}:${min}${ampm} ${tz}`;
}
