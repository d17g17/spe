import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAllProfiles } from '../services/reactQueryHooks';
import { filterProfiles, sortProfiles } from '../services/ProfileListManager';
import ProfileCard from '../components/profiles/ProfileCard';
import SearchBar from '../components/search/SearchBar';
import FilterPanel from '../components/filters/FilterPanel';
import ProfileFetchForm from '../components/search/ProfileFetchForm';
import { useNotification } from '../context/NotificationContext';
import socketService from '../services/socketService';
import Pagination from '../components/common/Pagination';

const SortDropdown = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="px-3 py-2 bg-slate-950/30 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-slate-600 min-w-[200px]"
  >
    {options.map(option => (
      <option key={option.id} value={option.id}>
        {option.label}
      </option>
    ))}
  </select>
);

const sortOptions = [
  { id: 'updatedAt_desc', label: 'Recently Updated' },
  { id: 'updatedAt_asc', label: 'Oldest Updated' },
  { id: 'name_asc', label: 'Name (A-Z)' },
  { id: 'name_desc', label: 'Name (Z-A)' },
  { id: 'friendsCount_desc', label: 'Most Friends' },
  { id: 'friendsCount_asc', label: 'Least Friends' },
  { id: 'lastLogoff_desc', label: 'Recently Online' },
  { id: 'lastLogoff_asc', label: 'Longest Offline' },
  { id: 'lastBadgeDate_desc', label: 'Recent Badge Activity' },
  { id: 'playtime2Weeks_desc', label: 'Most Active' },
  { id: 'country_asc', label: 'Country (A-Z)' },
  { id: 'inventoryValue_desc', label: 'Highest Inventory Value' }
];

const HomePage = () => {
  // State for search, sort, and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('updatedAt_desc');
  const [filters, setFilters] = useState({});
  const [refreshingProfiles, setRefreshingProfiles] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PROFILES_PER_PAGE = 300;
  
  // Notification context
  const { showSuccess, showError } = useNotification();
  
  // Debounce search query to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Extract sort parameters
  const [sortBy, sortDir] = sortOption.split('_');
  
  // Fetch profiles with server-side filtering and sorting
  const { data: profilesData, isLoading, error } = useAllProfiles(
    sortBy, 
    sortDir, 
    PROFILES_PER_PAGE, 
    (currentPage - 1) * PROFILES_PER_PAGE,
    filters, // Pass filters to server
    debouncedSearchQuery // Pass search query to server
  );
  
  // Set up websocket for real-time updates
  useEffect(() => {
    const socket = socketService.getSocket();
    
    // Listen for profile refresh events
    const handleProfileRefresh = (data) => {
      if (data.steamId) {
        setRefreshingProfiles(prev => [...prev, data.steamId]);
        
        // Remove the refreshing indicator after animation completes
        setTimeout(() => {
          setRefreshingProfiles(prev => prev.filter(id => id !== data.steamId));
        }, 2000);
      }
    };
    
    socket.on('profile:refresh', handleProfileRefresh);
    
    return () => {
      socket.off('profile:refresh', handleProfileRefresh);
    };
  }, []);
  
  // Profiles are now filtered and sorted server-side
  const filteredProfiles = React.useMemo(() => {
    // Check if profilesData exists and has profiles property
    if (!profilesData || !profilesData.profiles) return [];
    return profilesData.profiles;
  }, [profilesData]);
  
  // Calculate pagination data
  const totalProfiles = profilesData?.pagination?.total || 0;
  const totalPages = Math.ceil(totalProfiles / PROFILES_PER_PAGE);
  
  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0); // Scroll to top when changing pages
  };
  
  // Handle search query change - will be debounced before triggering API call
  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on new search
  };
  
  // Handle filter change - triggers server-side filtering
  const handleFilterChange = (filterId, value) => {
    if (filterId === null) {
      // Clear all filters
      setFilters({});
    } else {
      setFilters(prev => {
        // If value is falsy/empty, remove the filter
        if (!value && value !== false) {
          const newFilters = { ...prev };
          delete newFilters[filterId];
          return newFilters;
        }
        // Otherwise add/update the filter
        return { ...prev, [filterId]: value };
      });
    }
    setCurrentPage(1); // Reset to first page when filters change
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        duration: 0.2, 
        ease: "easeOut",
        type: "tween"
      }}
    >
      <ProfileFetchForm />

      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Stored Profiles</h1>
        <p className="text-slate-400 mb-4">
          {profilesData && profilesData.pagination ? `${profilesData.pagination.total} profile${profilesData.pagination.total !== 1 ? 's' : ''} found in database` : 'Loading profiles...'}
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6 mb-6">
        <div className="flex-1">
          <SearchBar 
            onSearch={handleSearch} 
            initialValue={searchQuery}
            placeholder="Search by name or Steam ID..."
            fullWidth
          />
        </div>
        
        <div className="flex-shrink-0 flex items-center">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-400 mr-2">Sort by:</label>
            <SortDropdown 
              value={sortOption}
              onChange={setSortOption}
              options={sortOptions}
            />
          </div>
        </div>
      </div>
      
      <FilterPanel 
        filters={filters}
        onFilterChange={handleFilterChange}
      />
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-blue-400 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
        </div>
      ) : error ? (
        <div className="metro-card text-red-500 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Error loading profiles: {error.message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map(profile => (
                  <ProfileCard 
                    key={profile.steamId} 
                    profile={profile} 
                    showRefreshAnimation={refreshingProfiles.includes(profile.steamId)}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="col-span-full flex flex-col items-center justify-center py-12"
                >
                  <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-xl text-slate-300 font-medium mb-1">No profiles found</h3>
          <p className="text-slate-500">
                    {profilesData && profilesData.profiles && profilesData.profiles.length > 0
                      ? 'Try adjusting your search or filters'
                      : 'Use the form above to fetch your first profile'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Pagination controls */}
          {filteredProfiles.length > 0 && totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              className="mt-8"
            />
          )}

          {/* Showing profile count and page info */}
          {filteredProfiles.length > 0 && (
            <div className="text-center text-slate-500 mt-4">
              Showing {filteredProfiles.length} of {profilesData?.pagination?.total || 0} profiles 
              {totalPages > 1 ? ` (Page ${currentPage} of ${totalPages})` : ''}
              {searchQuery || Object.keys(filters).length > 0 ? ' with current filters' : ''}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default HomePage;
