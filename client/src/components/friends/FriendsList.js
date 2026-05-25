import React from 'react';
import { AnimatePresence } from 'framer-motion';
import ProfileCard from '../profiles/ProfileCard';
import FilterPanel from '../filters/FilterPanel';
import SearchBar from '../search/SearchBar';
import FriendStatistics from './FriendStatistics';

// Sort options for friends list
const sortOptions = [
  { id: 'inventoryValue_desc', label: 'Highest Inventory Value' },
  { id: 'inventoryValue_asc', label: 'Lowest Inventory Value' },
  { id: 'name_asc', label: 'Name (A-Z)' },
  { id: 'name_desc', label: 'Name (Z-A)' },
  { id: 'personaState_desc', label: 'Online Status' },
  { id: 'lastLogoff_desc', label: 'Last Online' },
  { id: 'friendsCount_desc', label: 'Most Friends' }
];

/**
 * FriendsList component that handles displaying, filtering, and sorting friends
 */
const FriendsList = ({
  friendsData,
  profile,
  isLoadingFriends,
  filteredFriends,
  friendFetchStatus,
  refreshingFriends,
  searchQuery,
  sortOption,
  filters,
  onSearch,
  onSortChange,
  onFilterChange,
  onFetchFriends
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Friends List</h2>
        
        <button 
          onClick={onFetchFriends} 
          className={`btn ${friendFetchStatus && friendFetchStatus.status === 'in_progress' ? 'bg-slate-700' : 'btn-primary'}`}
          disabled={friendFetchStatus && friendFetchStatus.status === 'in_progress'}
        >
          {friendFetchStatus && friendFetchStatus.status === 'in_progress' ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {friendFetchStatus.percentage ? `${friendFetchStatus.percentage}%` : 'Fetching...'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Fetch Friends
            </>
          )}
        </button>
      </div>
      
      {/* Friend fetch progress indicator - Completely rebuilt */}
      {friendFetchStatus && (
        <div className="mb-4">
          {friendFetchStatus.status === 'in_progress' ? (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 text-blue-400 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-blue-200 font-medium">Processing Friends</span>
                </div>
                <div className="text-blue-300 text-sm font-mono">
                  {friendFetchStatus.current || 0}/{friendFetchStatus.total || 0} ({friendFetchStatus.percentage || 0}%)
                </div>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(friendFetchStatus.percentage || 0, 100)}%` }}
                ></div>
              </div>
              {friendFetchStatus.message && (
                <div className="text-blue-300 text-xs mt-2">
                  {friendFetchStatus.message}
                </div>
              )}
            </div>
          ) : friendFetchStatus.status === 'completed' ? (
            <div className="bg-green-900/50 border border-green-700 rounded-lg p-3 flex items-center">
              <svg className="w-5 h-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-200">Friend fetch completed successfully!</span>
            </div>
          ) : friendFetchStatus.status === 'error' ? (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-200">{friendFetchStatus.message || 'Friend fetch failed'}</span>
            </div>
          ) : null}
        </div>
      )}
      
      {/* Friend search and filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
        <div className="w-full sm:w-2/3">
          <SearchBar 
            onSearch={onSearch} 
            initialValue={searchQuery}
            placeholder="Search friends..."
            fullWidth
          />
        </div>
        
        <div className="w-full sm:w-1/3 flex items-center">
          <label className="text-sm text-slate-400 mr-2 whitespace-nowrap">Sort by:</label>
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value)}
            className="input w-full"
          >
            {sortOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <FilterPanel 
        filters={filters}
        onFilterChange={onFilterChange}
      />
      
      {/* Friend Statistics */}
      <FriendStatistics 
        friends={friendsData?.friends}
        filteredFriends={filteredFriends}
        totalFriendsCount={profile?.friendsCount}
        isVisible={!isLoadingFriends && friendsData?.friends && friendsData.pagination && friendsData.pagination.total > 0}
      />
      
      {/* Friends list */}
      {isLoadingFriends ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : !friendsData || !friendsData.friends ? (
        <div className="metro-card flex flex-col items-center justify-center py-8">
          <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-xl text-slate-300 font-medium mb-1">No friends data</h3>
          <p className="text-slate-500 mb-4">
            Click the "Fetch Friends" button to retrieve this profile's friends
          </p>
        </div>
      ) : filteredFriends.length === 0 ? (
        <div className="metro-card flex flex-col items-center justify-center py-8">
          <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl text-slate-300 font-medium mb-1">No friends found</h3>
          <p className="text-slate-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredFriends.map(friend => (
              <ProfileCard 
                key={friend.steamId} 
                profile={{...friend, isFriend: true}} 
                showRefreshAnimation={refreshingFriends.includes(friend.steamId)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      
      {/* Pagination info */}
      {friendsData && friendsData.pagination && (
        <div className="mt-4 text-center text-sm text-slate-500">
          Showing {filteredFriends.length} of {friendsData.pagination.total} friends
        </div>
      )}
    </div>
  );
};

export default FriendsList;
