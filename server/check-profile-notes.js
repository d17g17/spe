const { Profile } = require('./src/models');

async function checkProfile() {
  try {
    const profile = await Profile.findByPk('76561198201941110');
    console.log('Profile found:', !!profile);
    if (profile) {
      console.log('Notes:', profile.notes || 'No notes');
      console.log('Name:', profile.name);
      console.log('Steam ID:', profile.steamId);
    } else {
      console.log('Profile not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkProfile();