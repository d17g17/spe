const http = require('http');

// Test if the specific profile is being served correctly
async function testProfileDisplay() {
    const steamId = '76561198139955893';
    
    try {
        console.log(`Testing profile display for Steam ID: ${steamId}`);
        console.log('\n=== Testing API Response ===');
        
        // Test the API endpoint
        const response = await makeHttpRequest(`http://localhost:3002/api/profiles/local/${steamId}`);
        const data = JSON.parse(response);
        
        if (data && data.success && data.data) {
            const profile = data.data;
            console.log(`✅ Profile found: ${profile.name}`);
            console.log(`✅ Steam ID: ${profile.steamId}`);
            
            if (profile.notes) {
                console.log(`✅ Notes field present: "${profile.notes}"`);
                console.log(`✅ Notes length: ${profile.notes.length} characters`);
                
                // Check if notes contain expected content
                if (profile.notes.includes('StatTrak™ M9 Bayonet') && profile.notes.includes('Sport Gloves')) {
                    console.log('✅ Notes contain expected items (M9 Bayonet and Sport Gloves)');
                } else {
                    console.log('⚠️  Notes content may not match expected items');
                }
            } else {
                console.log('❌ Notes field is missing or empty');
                return;
            }
            
            console.log('\n=== Frontend Display Check ===');
            console.log('The profile notes should now be visible in:');
            console.log('1. Home page profile cards');
            console.log('2. Friend lists');
            console.log('3. Individual profile pages');
            console.log('\nNotes will appear in a yellow-highlighted box with the text:');
            console.log(`"${profile.notes}"`);
            
        } else {
            console.log('❌ Profile not found or API error');
            console.log('Response:', data);
        }
        
    } catch (error) {
        console.error('❌ Error testing profile display:', error.message);
    }
}

function makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
        const request = http.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(data);
            });
        });
        request.on('error', (error) => {
            reject(error);
        });
    });
}

testProfileDisplay();