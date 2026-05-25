const http = require('http');

// Test fetching profile through frontend API
async function testFrontendProfile() {
    const steamId = '76561198139955893';
    
    try {
        console.log(`Testing frontend API for Steam ID: ${steamId}`);
        
        // Test the API endpoint that frontend uses
        const response = await makeHttpRequest(`http://localhost:3002/api/profiles/local/${steamId}`);
        const data = JSON.parse(response);
        
        if (data && data.success) {
            const profile = data.data;
            console.log('\n=== Profile Data ===');
            console.log(`Steam ID: ${profile.steamId}`);
            console.log(`Name: ${profile.name}`);
            console.log(`Notes: ${profile.notes || 'No notes found'}`);
            console.log(`Notes length: ${profile.notes ? profile.notes.length : 0}`);
            console.log(`Notes type: ${typeof profile.notes}`);
            
            if (profile.notes) {
                console.log('\n✅ Notes field is present in API response');
                console.log(`Notes content: "${profile.notes}"`);
            } else {
                console.log('\n❌ Notes field is missing or empty in API response');
            }
        } else {
            console.log('❌ API request failed or returned unsuccessful response');
            console.log('Response:', data);
        }
    } catch (error) {
        console.error('❌ Error testing frontend profile API:', error.message || error);
        console.error('Full error:', error);
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

testFrontendProfile();