import React, { useState, memo, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatDate, getVisibilityStatus, formatBanStatus, getPersonaState, getPersonaStateBorderColor, getSteamProfileUrl } from '../../utils/formatUtils';
import { getFormattedLocation, getLocationNames } from '../../utils/locationUtils';
import { useDeleteProfile } from '../../services/reactQueryHooks';
import { useNotification } from '../../context/NotificationContext';
import { queryClient } from '../../services/reactQueryHooks';
import ConfirmationDialog from '../common/ConfirmationDialog';
import InventoryBadge from '../badges/InventoryBadge';

// Component for displaying online status
const OnlineStatusBadge = memo(({ state, gameId, isCompact }) => {
  const status = useMemo(() => getPersonaState(state, gameId), [state, gameId]);
  const badgeClass = useMemo(() => 
    status.color.includes('green') ? 'badge-success' : 
    status.color.includes('red') ? 'badge-danger' : 
    status.color.includes('yellow') ? 'badge-warning' : 
    status.color.includes('blue') || status.color.includes('purple') || status.color.includes('indigo') ? 'badge-info' : 
    'badge-secondary', [status.color]);
    
  return (
    <span className={`badge ${badgeClass} ${isCompact ? 'text-xs py-0 px-1.5' : ''}`}>
      {status.text}
    </span>
  );
});

// Component for displaying profile visibility state
const VisibilityBadge = memo(({ state, isCompact }) => {
  const status = useMemo(() => getVisibilityStatus(state), [state]);
  const badgeClass = useMemo(() => 
    status.color.includes('green') ? 'badge-success' : 
    status.color.includes('red') ? 'badge-danger' : 
    'badge-warning', [status.color]);
  
  return (
    <span className={`badge ${badgeClass} ${isCompact ? 'text-xs py-0 px-1.5' : ''}`}>
      {status.text}
    </span>
  );
});

// Component for displaying profile ban status
const BanBadge = memo(({ profile, isCompact }) => {
  const banStatus = useMemo(() => 
    formatBanStatus(profile.vacBanned, profile.gameBanned, profile.tradeBanned), 
    [profile.vacBanned, profile.gameBanned, profile.tradeBanned]
  );
  
  if (banStatus.text === 'None') {
    return (
      <span className={`badge badge-success ${isCompact ? 'text-xs py-0 px-1.5' : ''}`}>No Bans</span>
    );
  }
  
  return (
    <span className={`badge badge-danger ${isCompact ? 'text-xs py-0 px-1.5' : ''}`}>{banStatus.text}</span>
  );
});

// Country flag emoji from country code
const CountryFlag = memo(({ countryCode }) => {
  const emoji = useMemo(() => {
    if (!countryCode) return null;
    
    // Convert country code to emoji flag
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    
    return String.fromCodePoint(...codePoints);
  }, [countryCode]);
  
  if (!countryCode) return null;
  
  return (
    <span className="text-lg mr-1" title={countryCode.toUpperCase()}>
      {emoji}
    </span>
  );
});

const ProfileCard = memo(({ profile, showRefreshAnimation, isCompact = false }) => {
  const navigate = useNavigate();
  const deleteProfileMutation = useDeleteProfile();
  const { showSuccess, showError } = useNotification();
  
  // State for confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Memoized handlers to prevent unnecessary re-renders
  const handleDelete = useCallback((e) => {
    e.stopPropagation(); // Prevent navigating to profile when clicking delete
    e.preventDefault();
    
    // Show confirmation dialog instead of using window.confirm
    setShowDeleteConfirm(true);
  }, []);
  
  const confirmDelete = useCallback(() => {
    deleteProfileMutation.mutate(profile.steamId, {
      onSuccess: () => {
        showSuccess(`Successfully deleted profile: ${profile.name}`);
        queryClient.invalidateQueries('allProfiles');
      },
      onError: (error) => {
        showError(`Failed to delete profile: ${error.message}`);
      }
    });
  }, [deleteProfileMutation, profile.steamId, profile.name, showSuccess, showError]);

  // Handle opening profile in Steam
  const handleOpenInSteam = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`https://steamcommunity.com/profiles/${profile.steamId}`, '_blank');
  }, [profile.steamId]);

  // Memoized inventory badge data
  const mergedInventoryBadge = useMemo(() => 
    profile.inventoryBadge || (
      (profile.inventoryStatus || profile.inventoryValue !== undefined) ? {
        status: profile.inventoryStatus,
        value: profile.inventoryValue,
        skipReason: profile.inventorySkipReason,
        lastChecked: profile.inventoryLastChecked,
      } : null
    ), [profile.inventoryBadge, profile.inventoryStatus, profile.inventoryValue, profile.inventorySkipReason, profile.inventoryLastChecked]
  );

  // Memoized computed values
  const avatarUrl = useMemo(() => 
    profile.avatarUrl || 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg',
    [profile.avatarUrl]
  );
  
  const steamProfileUrl = useMemo(() => getSteamProfileUrl(profile.steamId), [profile.steamId]);
  const personaStateBorderColor = useMemo(() => getPersonaStateBorderColor(profile.personaState, profile.gameId), [profile.personaState, profile.gameId]);
  const playtimeHours = useMemo(() => 
    profile.playtime2Weeks ? Math.round(profile.playtime2Weeks / 60) : null,
    [profile.playtime2Weeks]
  );
  const formattedLastBadgeDate = useMemo(() => 
    profile.lastBadgeDate ? formatDate(profile.lastBadgeDate) : null,
    [profile.lastBadgeDate]
  );

  // Handle potential differences in location property names
  const countryCode = useMemo(() => profile.country || profile.locCountryCode, [profile.country, profile.locCountryCode]);
  const stateCode = useMemo(() => profile.locStateCode || profile.state, [profile.locStateCode, profile.state]);
  const cityId = useMemo(() => profile.locCityId || profile.city, [profile.locCityId, profile.city]);

  const locationDisplay = useMemo(() => {
    if (!countryCode) {
      return null;
    }
    const names = getLocationNames(countryCode, stateCode, cityId);
    const locationParts = [];
    if (names.cityName) {
      locationParts.push(names.cityName);
    }
    if (names.stateName) {
      locationParts.push(names.stateName);
    }
    return locationParts.join(', ');
  }, [countryCode, stateCode, cityId]);



  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={`metro-card relative ${showRefreshAnimation ? 'border-blue-500 shadow-lg shadow-blue-500/20' : ''} ${profile.isFriend ? 'p-2' : 'p-2'}`}
    >
      {showRefreshAnimation && (
        <div className="absolute inset-0 bg-blue-500/10 rounded-xl z-0 animate-pulse"></div>
      )}
      
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(steamProfileUrl, '_blank');
            }}
            className="group relative transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-lg"
            title="Open Steam Profile"
          >
            <img 
              src={avatarUrl} 
              alt={`${profile.name}'s avatar`}
              className={`${profile.isFriend ? 'w-10 h-10' : 'w-12 h-12'} rounded-lg border-2 ${personaStateBorderColor} transition-all group-hover:shadow-lg`}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200"></div>
          </button>
        </div>
        
        <div className="ml-2 flex-1">
          <div>
            <div className="flex items-center flex-wrap gap-1 mb-1">
              <div className="flex items-center">
                <h3 className="text-lg font-semibold text-white mr-2">
                  {profile.name || 'Unknown User'}
                </h3>
                {countryCode && (
                  <CountryFlag countryCode={countryCode} />
                )}
              </div>
              <div className="flex items-center flex-wrap gap-1.5">
                <OnlineStatusBadge state={profile.personaState} gameId={profile.gameId} isCompact={profile.isFriend} />
                <VisibilityBadge state={profile.communityVisibilityState} isCompact={profile.isFriend} />
                <BanBadge profile={profile} isCompact={profile.isFriend} />
                <InventoryBadge badge={mergedInventoryBadge} compact={profile.isFriend} />
                <span className={`badge badge-info ${profile.isFriend ? 'text-xs py-0 px-1.5' : ''} flex items-center gap-1`} title="Friends Count">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`${profile.isFriend ? 'h-3 w-3' : 'h-3 w-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {profile.friendsCount || 0}
                </span>
                {formattedLastBadgeDate && (
                  <span className={`badge badge-secondary ${profile.isFriend ? 'text-xs py-0 px-1.5' : ''} flex items-center gap-1`} title={`Last Badge: ${formattedLastBadgeDate}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`${profile.isFriend ? 'h-3 w-3' : 'h-3 w-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    {formattedLastBadgeDate}
                  </span>
                )}
              </div>
            </div>
            {(profile.realName || locationDisplay) && (
              <p className="text-sm text-slate-400">
                {profile.realName}
                {locationDisplay && (
                  <span className={`${profile.realName ? 'ml-2' : ''} text-slate-500`}>
                    {profile.realName ? '| ' : ''}{locationDisplay}
                  </span>
                )}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(steamProfileUrl, '_blank');
              }}
              className="text-xs text-slate-500 font-mono hover:text-blue-400 hover:underline transition-colors cursor-pointer focus:outline-none focus:text-blue-400 focus:underline"
              title="Open Steam Profile"
            >
              {profile.steamId}
            </button>
          </div>
          
          <div className={`${profile.isFriend ? 'mt-2' : 'mt-3'} flex justify-between items-start`}>
            {/* Left side - 2 week playtime and last game */}
            <div className="flex-1 space-y-1">
              <div className={`${profile.isFriend ? 'text-xs' : 'text-sm'} flex items-center`}>
                <span className="text-slate-400 font-medium min-w-fit">2W Playtime:</span> 
                <span className="text-white ml-2 font-mono">
                  {playtimeHours ? `${playtimeHours}h` : 'N/A'}
                </span>
              </div>
              
              <div className={`${profile.isFriend ? 'text-xs' : 'text-sm'} flex items-center`}>
                <span className="text-slate-400 font-medium min-w-fit">Last Game:</span> 
                <span className="text-white ml-2 truncate">
                  {profile.lastPlayedGame || 'N/A'}
                </span>
              </div>
              
              {/* Profile Notes */}
              {profile.notes && (
                <div className={`${profile.isFriend ? 'text-xs' : 'text-sm'} mt-1`}>
                  <div className="text-yellow-400 px-2 py-1 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs leading-tight max-w-full overflow-hidden">
                    <span className="text-yellow-300 font-medium text-xs">📝 </span>
                    <span className="break-words">{profile.notes}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Right side - action buttons */}
             <div className="flex gap-1.5 ml-4 flex-shrink-0">
               <a
                 href={`https://steamcommunity.com/profiles/${profile.steamId}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 onClick={(e) => { e.stopPropagation(); }}
                 className="btn-icon bg-slate-900/50 hover:bg-slate-900/70 text-white border border-slate-700 hover:border-slate-600 p-2"
                 title="Open in Steam"
               >
                 <img src="https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/steam.svg" alt="Steam" className="h-5 w-5" />
               </a>
               <a
                 href={`https://gamersclub.com.br/buscar?busca=${encodeURIComponent(`https://steamcommunity.com/profiles/${profile.steamId}`)}`}
                 target="_blank"
                 rel="noopener noreferrer"
                 onClick={(e) => { e.stopPropagation(); }}
                 className="btn-icon bg-slate-900/50 hover:bg-slate-900/70 text-white border border-slate-700 hover:border-slate-600 p-2"
                 title="Open in GC"
               >
                 <img src="https://gamersclub.com.br/favicon.ico" alt="GC" className="h-5 w-5" />
               </a>
               <Link
                 to={`/profile/${profile.steamId}`}
                 className="btn-icon bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 hover:border-blue-400 p-2"
                 title="View Profile"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                   <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                   <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                 </svg>
               </Link>
               <button 
                 onClick={handleDelete}
                 className="btn-icon bg-red-900/50 hover:bg-red-900/70 text-red-300 border border-red-700 hover:border-red-600 p-2"
                 title="Delete Profile"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                 </svg>
               </button>
             </div>
           </div>
         </div>
       </div>
      
      {/* Custom confirmation dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Confirm Profile Deletion"
        message={`Are you sure you want to delete ${profile.name}? This action cannot be undone.`}
        confirmText="Delete Profile"
        cancelText="Cancel"
        type="danger"
      />
    </motion.div>
  );
});

// Custom comparison function to ensure inventory updates trigger re-renders
const arePropsEqual = (prevProps, nextProps) => {
  // Always re-render if showRefreshAnimation changes
  if (prevProps.showRefreshAnimation !== nextProps.showRefreshAnimation) {
    return false;
  }
  
  // Check if profile object reference changed
  if (prevProps.profile !== nextProps.profile) {
    return false;
  }
  
  // Deep check inventory-related fields that might not trigger shallow comparison
  const prevInventory = prevProps.profile?.inventoryBadge;
  const nextInventory = nextProps.profile?.inventoryBadge;
  
  if (prevInventory !== nextInventory) {
    // Check individual inventory fields
    if (prevInventory?.status !== nextInventory?.status ||
        prevInventory?.value !== nextInventory?.value ||
        prevInventory?.skipReason !== nextInventory?.skipReason ||
        prevInventory?.lastChecked !== nextInventory?.lastChecked ||
        prevInventory?.has2025ServiceMedal !== nextInventory?.has2025ServiceMedal) {
      return false;
    }
  }
  
  // Check individual inventory fields from profile (for backward compatibility)
  if (prevProps.profile?.inventoryStatus !== nextProps.profile?.inventoryStatus ||
      prevProps.profile?.inventoryValue !== nextProps.profile?.inventoryValue ||
      prevProps.profile?.inventorySkipReason !== nextProps.profile?.inventorySkipReason ||
      prevProps.profile?.inventoryLastChecked !== nextProps.profile?.inventoryLastChecked) {
    return false;
  }
  
  // Check notes field
  if (prevProps.profile?.notes !== nextProps.profile?.notes) {
    return false;
  }
  
  // Check compact prop
  if (prevProps.isCompact !== nextProps.isCompact) {
    return false;
  }
  
  return true;
};

ProfileCard.displayName = 'ProfileCard';

export default memo(ProfileCard, arePropsEqual);
