/**
 * Generate a profile picture/avatar for a wallet address
 * Uses a simple hash-based color approach with initials
 */

export function generateAvatarUrl(address: string, size: number = 40): string {
  // Use a simple hash to generate consistent colors for the same address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate hue from hash (0-360)
  const hue = Math.abs(hash % 360);
  
  // Generate saturation and lightness for appealing colors
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash >> 8) % 15); // 45-60%
  
  // Get first 2 characters for initials
  const initials = address.slice(0, 2).toUpperCase();
  
  // Create a data URL for SVG avatar
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="hsl(${hue}, ${saturation}%, ${lightness}%)" rx="${size / 2}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>
  `.trim();
  
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

export function getInitials(address: string): string {
  return address.slice(0, 2).toUpperCase();
}

