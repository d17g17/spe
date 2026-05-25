import React from 'react';
import { getInventoryBadgeInfo } from '../../utils/inventoryUtils';

/**
 * InventoryBadge component
 * @param {Object} props
 * @param {Object} props.badge - inventoryBadge object from backend
 * @param {boolean} props.compact - if true, use smaller padding/text
 */
export default function InventoryBadge({ badge, compact = false }) {
  const info = getInventoryBadgeInfo(badge);
  return (
    <span
      className={`badge ${info.color} ${compact ? 'text-xs py-0 px-1.5' : ''} flex items-center gap-1`}
      title={info.tooltip}
    >
      {info.label}
      {info.medalIcons && info.medalIcons.map((icon, index) => (
        <span key={index} className="inline-flex">{icon}</span>
      ))}
    </span>
  );
}
