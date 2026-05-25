const { Profile } = require('./src/models');

async function checkProfile() {
  try {
    const profile = await Profile.findOne({
      where: { steamId: '76561198139955893' }
    });
    
    if (profile) {
      console.log('Profile found:');
      console.log('Steam ID:', profile.steamId);
      console.log('Name:', profile.name);
      console.log('Notes:', profile.notes);
      console.log('Updated At:', profile.updatedAt);
    } else {
      console.log('Profile not found for Steam ID: 76561198139955893');
    }
  } catch (error) {
    console.error('Error checking profile:', error);
  } finally {
    process.exit(0);
  }
}

checkProfile();