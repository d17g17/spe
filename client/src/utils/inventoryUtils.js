import React from 'react';

// Medal Image Components
const ServiceMedalIcon = () => (
  <img 
    src="/2025-medal.png" 
    alt="2025 Service Medal" 
    width="16" 
    height="16" 
    style={{ display: 'inline-block' }}
  />
);

const PremierSeasonOneMedalIcon = () => (
  <img 
    src="/season1-medal.png" 
    alt="Premier Season One Medal" 
    width="16" 
    height="16" 
    style={{ display: 'inline-block' }}
  />
);

const PremierSeasonTwoMedalIcon = () => (
  <img 
    src="/season2-medal.png" 
    alt="Premier Season Two Medal" 
    width="16" 
    height="16" 
    style={{ display: 'inline-block' }}
  />
);

export function getInventoryBadgeInfo(inventoryBadge) {
  // If no badge data at all
  if (!inventoryBadge) return { label: 'INV', color: 'badge-secondary', tooltip: 'Inventory not checked' };
  
  // Handle potentially missing or null values in the badge object
  const { status, value, skipReason, lastChecked, has2025ServiceMedal, hasPremierSeasonOneMedal, hasPremierSeasonTwoMedal } = inventoryBadge;
  
  // If status is null, undefined, or empty string, treat as not checked
  if (!status || status === '') {
    // If we have a value but no status, it's likely checked
      if (typeof value === 'number' && value > 0) {
        // Value-based color scheme
        let color;
        if (value >= 1000) color = 'badge-very-high';
        else if (value >= 500) color = 'badge-high';
        else if (value >= 100) color = 'badge-good';
        else if (value >= 25) color = 'badge-moderate';
        else if (value >= 5) color = 'badge-low';
        else color = 'badge-empty';
        
        return {
          label: `$${Math.round(value)}`,
          color,
          tooltip: `Value: $${value.toFixed?.(2) || value} (date unknown)`
        };
      }
    // No status and no value means not checked
    return { label: 'INV', color: 'badge-secondary', tooltip: 'Inventory not checked' };
  }
  
  // Normal status-based display
  switch (status) {
    case 'checked':
      const baseLabel = `$${Math.round(value || 0)}`;
      let medalIcons = [];
      let medalTooltips = [];
      
      if (has2025ServiceMedal) {
        medalIcons.push(<ServiceMedalIcon key="service" />);
        medalTooltips.push('Contains 2025 Service Medal');
      }
      if (hasPremierSeasonOneMedal) {
        medalIcons.push(<PremierSeasonOneMedalIcon key="premier1" />);
        medalTooltips.push('Contains Premier Season One Medal');
      }
      if (hasPremierSeasonTwoMedal) {
        medalIcons.push(<PremierSeasonTwoMedalIcon key="premier2" />);
        medalTooltips.push('Contains Premier Season Two Medal');
      }
      
      const medalTooltipText = medalTooltips.length > 0 ? ' • ' + medalTooltips.join(' • ') : '';
      
      // Value-based color scheme
      let color;
      if (value >= 1000) color = 'badge-very-high';      // $1000+ - Purple/Gold
      else if (value >= 500) color = 'badge-high';       // $500-999 - Orange
      else if (value >= 100) color = 'badge-good';       // $100-499 - Blue
      else if (value >= 25) color = 'badge-moderate';    // $25-99 - Green
      else if (value >= 5) color = 'badge-low';          // $5-24 - Yellow
      else color = 'badge-empty';                        // <$5 - Gray
      
      return {
        label: baseLabel,
        color,
        tooltip: `Value: $${value?.toFixed?.(2) || 0} (checked ${timeAgo(lastChecked)})${medalTooltipText}`,
        medalIcons
      };
    case 'skipped':
      return {
        label: 'SKIP',
        color: 'badge-warning',
        tooltip: skipReason || 'Skipped'
      };
    case 'private':
      return { label: 'PRIVATE', color: 'badge-danger', tooltip: 'Inventory private' };
    case 'empty':
      return { label: 'EMPTY', color: 'badge-warning', tooltip: 'Empty inventory' };
    case 'error':
      return { label: 'ERROR', color: 'badge-danger', tooltip: 'Error checking inventory' };
    default:
      // For any unrecognized status, fall back to 'INV' instead of 'UNKNOWN'
      console.warn(`Unknown inventory status: ${status}`);
      return { label: 'INV', color: 'badge-secondary', tooltip: 'Inventory not checked' };
  }
}

// Helper for relative time without adding heavy date-fns dependency
function timeAgo(dateStr) {
  if (!dateStr) return 'unknown';
  const diffSec = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
