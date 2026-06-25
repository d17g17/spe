const { models } = require('./src/db');

async function clean() {
  const dummyProfiles = await models.Profile.findAll({
    where: { name: null }
  });

  console.log(`Found ${dummyProfiles.length} dummy profiles without a name.`);

  if (dummyProfiles.length === 0) {
    console.log('Nothing to clean.');
    return;
  }

  const ids = dummyProfiles.map(p => p.steamId);

  // Delete CS2 inventories for these profiles
  const deletedInvs = await models.CS2Inventory.destroy({
    where: { profileId: ids }
  });
  console.log(`Deleted ${deletedInvs} CS2 inventory records.`);

  // Delete the profiles themselves
  const deletedProfiles = await models.Profile.destroy({
    where: { steamId: ids }
  });
  console.log(`Deleted ${deletedProfiles} dummy profiles.`);
}

clean().then(() => {
  console.log('Cleanup complete.');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
