import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import CS2InventoryComponent from '../inventory/CS2InventoryComponent';
import { formatDate, getVisibilityStatus, getPersonaState, formatBanStatus, getPersonaStateBorderColor, getSteamProfileUrl } from '../../utils/formatUtils';
import { getFormattedLocation, getLocationNames } from '../../utils/locationUtils';
import * as apiService from '../../services/api';

/**
 * Profile header component that displays the main profile information
 */
const ProfileHeader = ({ 
  profile, 
  cs2InventoryData,
  isRefreshingProfile,
  isFetchingInventory,
  isInventoryQueryFetching,
  onRefreshProfile,
  onDeleteProfile,
  onFetchInventory,
  showSuccess,
  showError,
  currentFriendIds
}) => {
  const [isOpeningInvErrors, setIsOpeningInvErrors] = useState(false);

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

  if (!profile) return null;

  // Get formatted status
  const visibilityStatus = getVisibilityStatus(profile.communityVisibilityState);
  const personaStatus = getPersonaState(profile.personaState, profile.gameId);
  const banStatus = formatBanStatus(profile.vacBanned, profile.gameBanned, profile.tradeBanned);

  const handleOpenInvErrors = async () => {
    if (!currentFriendIds || currentFriendIds.length === 0) {
      showSuccess('No friends to check for inventory errors.', { autoClose: 3000 });
      return;
    }

    setIsOpeningInvErrors(true);
    showSuccess(`Checking ${currentFriendIds.length} friend(s) for inventory errors...`, { autoClose: 3000 });
    try {
      const erroredSteamIds = await apiService.getProfilesWithInventoryErrors(currentFriendIds);
      
      if (erroredSteamIds && erroredSteamIds.length > 0) {
        const profilesToOpenCount = erroredSteamIds.length;

        showSuccess(
          `Found ${profilesToOpenCount} friend(s) with inventory errors. Attempting to open all...`, 
          { autoClose: 5000 }
        );

        erroredSteamIds.forEach((id, index) => {
          // Use a small delay for each tab. This is a best-effort to avoid popup blockers.
          // Browsers are very strict about window.open unless it's in direct response to a single user click.
          setTimeout(() => { 
            window.open(`https://steamcommunity.com/profiles/${id}`, '_blank');
          }, index * 400); // Stagger opening tabs
        });

      } else {
        showSuccess('No inventory errors found among the current friends.', { autoClose: 3000 });
      }
    } catch (error) {
      showError(error.message || 'Failed to fetch profiles with inventory errors.');
    } finally {
      setIsOpeningInvErrors(false);
    }
  };

  return (
    <div className="metro-card mb-6">
      <div className="flex flex-col md:flex-row">
        {/* Avatar and basic info */}
        <div className="flex-shrink-0 flex items-center mb-4 md:mb-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(getSteamProfileUrl(profile.steamId), '_blank');
            }}
            className="group relative transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded-lg mr-4"
            title="Open Steam Profile"
          >
            <img 
            src={profile.avatarUrl || 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg'} 
            alt={`${profile.name}'s avatar`}
            className={`w-24 h-24 rounded-xl border-4 ${getPersonaStateBorderColor(profile.personaState, profile.gameId)} shadow-lg`}
          />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200"></div>
          </button>
          
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-white">{profile.name || 'Unknown User'}</h1>
            {profile.realName && (
              <p className="text-lg text-slate-400">
                {profile.realName}
              </p>
            )}
            {locationDisplay && (
              <p className="text-lg text-slate-500">
                {locationDisplay}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(getSteamProfileUrl(profile.steamId), '_blank');
              }}
              className="text-sm text-slate-500 font-mono mt-1 hover:text-blue-400 hover:underline transition-colors cursor-pointer focus:outline-none focus:text-blue-400 focus:underline"
              title="Open Steam Profile"
            >
              {profile.steamId}
            </button>
            
            <div className="flex space-x-2 mt-2">
              <span className={`badge ${visibilityStatus.color.includes('green') ? 'badge-success' : visibilityStatus.color.includes('red') ? 'badge-danger' : 'badge-warning'}`}>
                {visibilityStatus.text}
              </span>
              <span className={`badge ${personaStatus.color.includes('green') ? 'badge-success' : personaStatus.color.includes('red') ? 'badge-danger' : personaStatus.color.includes('yellow') ? 'badge-warning' : 'badge-info'}`}>
                {personaStatus.text}
              </span>
              {banStatus.text !== 'None' && (
                <span className="badge badge-danger">
                  {banStatus.text}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex-shrink-0 ml-auto flex flex-wrap space-x-2 items-start">
          <button 
            onClick={onRefreshProfile} 
            className="btn btn-secondary min-w-[130px] flex items-center justify-center transition-all duration-200 hover:scale-105"
            disabled={isRefreshingProfile}
          >
            {isRefreshingProfile ? (
              <>
                <svg className="animate-spin mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-white font-medium">Refreshing...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
          
          <a
            href={`https://steamcommunity.com/profiles/${profile.steamId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); }}
            className="btn btn-secondary"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Steam
          </a>
          
          <button 
            onClick={onDeleteProfile} 
            className="btn btn-danger"
            disabled={isRefreshingProfile}
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <button
            onClick={handleOpenInvErrors}
            className="btn btn-warning min-w-[130px] flex items-center justify-center transition-all duration-200 hover:scale-105"
            disabled={isOpeningInvErrors || isRefreshingProfile}
          >
            {isOpeningInvErrors ? (
              <>
                <svg className="animate-spin mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-white font-medium">Opening...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Open Inv. Errors
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* CS2 Inventory */}
      <div className="mt-6">
        <h2 className="text-xl font-bold text-white mb-2">CS2 Inventory</h2>
        <CS2InventoryComponent inventory={cs2InventoryData} loading={isFetchingInventory || isInventoryQueryFetching} />
        <button
          className={`btn mt-2 ${isFetchingInventory ? 'bg-slate-700 cursor-not-allowed' : 'btn-primary'}`}
          disabled={isFetchingInventory}
          onClick={async () => {
            if (isFetchingInventory) return;
            try {
              await onFetchInventory();
              showSuccess('Inventory processed');
            } catch (err) {
              showError(err.message);
            }
          }}
        >
          {isFetchingInventory ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Fetching...
            </>
          ) : (
            'Refresh Inventory'
          )}
        </button>
      </div>

      {/* Detailed profile info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Profile Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Profile URL:</span>
              <a 
                href={profile.profileUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 hover:underline break-all"
              >
                {profile.profileUrl}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Country:</span>
              <span className="text-white">
                {countryCode ? getLocationNames(countryCode).countryName || countryCode.toUpperCase() : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">State:</span>
              <span className="text-white">
                {stateCode ? 
                  getLocationNames(countryCode, stateCode).stateName || stateCode 
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">City:</span>
              <span className="text-white">
                {cityId ? 
                  getLocationNames(countryCode, stateCode, cityId).cityName || cityId 
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Online:</span>
              <span className="text-white">{profile.lastLogoff ? formatDate(profile.lastLogoff, true) : 'Unknown'}</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Game Activity</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Friends Count:</span>
              <span className="text-white">{profile.friendsCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Played Game:</span>
              <span className="text-white">{profile.lastPlayedGame || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Recent Playtime:</span>
              <span className="text-white">
                {profile.playtime2Weeks ? `${Math.round(profile.playtime2Weeks / 60)}h` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Badge Date:</span>
              <span className="text-white">{profile.lastBadgeDate ? formatDate(profile.lastBadgeDate) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Updated:</span>
              <span className="text-white">{formatDate(profile.updatedAt, true)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Profile Notes */}
      {profile.notes && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-white mb-2">Notes</h3>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <pre className="text-slate-300 whitespace-pre-wrap text-sm font-mono">{profile.notes}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileHeader;
