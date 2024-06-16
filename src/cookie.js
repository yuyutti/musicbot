const fs = require('fs');
const path = require('path');
const cookie = require('cookie');

async function refreshCookie() {
    const cookiePath = path.join(__dirname, '..', '.data', 'youtube.json');
    const cookieData = fs.readFileSync(cookiePath, 'utf8');
    const cookiePurse = JSON.parse(cookieData);

    // 既存のクッキーを使ってYouTubeにアクセスする
    const response = await fetch('https://www.youtube.com/', {
        headers: {
            'cookie': cookiePurse.cookie
        }
    });

    // レスポンスから新しいクッキーを取得する
    const setCookieHeader = response.headers.get('set-cookie');
    if (!setCookieHeader) return;

    // set-cookieヘッダーが複数のクッキーに分かれている場合の処理
    const newCookies = setCookieHeader.split(',').map(cookieString => cookie.parse(cookieString));

    // 既存のクッキーをオブジェクトにパースする
    let existingCookies = cookie.parse(cookiePurse.cookie);

    // 新しいクッキーで既存のクッキーを更新する
    newCookies.forEach(newCookie => {
        Object.keys(newCookie).forEach(cookieName => {
            if (existingCookies.hasOwnProperty(cookieName)) {
                existingCookies[cookieName] = newCookie[cookieName];
            }
        });
    });

    // 更新されたクッキーを文字列にシリアライズする
    const updatedCookie = Object.entries(existingCookies).map(([name, value]) => `${name}=${value}`).join('; ');

    // 更新されたクッキーをファイルに保存する
    cookiePurse.cookie = updatedCookie;
    fs.writeFileSync(cookiePath, JSON.stringify(cookiePurse, null, 4));
    console.log('Cookie has been updated.');
}

setInterval(refreshCookie, 10 * 60 * 1000);

module.exports = { refreshCookie };