// Keep integration fixtures deterministic and never send test recipients to Roblox.
export function mockRoblox(blockExternal = false) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://users.roblox.com/v1/usernames/users') {
      const name = JSON.parse(init.body).usernames[0];
      if (name === 'unavailable_user') throw new Error('ROBLOX_TEMPORARILY_UNAVAILABLE');
      return Response.json({ data: name === 'unknown_user' ? [] : [{ id: 42, name, displayName: 'Test recipient' }] });
    }
    if (url.startsWith('https://apis.roblox.com/game-passes/')) {
      return Response.json({ ProductType: 'Game Pass', Name: 'Test pass', PriceInRobux: 143, IsForSale: true, Creator: { CreatorType: 'User', CreatorTargetId: 42 } });
    }
    if (url.startsWith('https://thumbnails.roblox.com/')) return Response.json({ data: [] });
    if (blockExternal && !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('EXTERNAL_REQUEST_DISABLED_IN_TESTS');
    return original(input, init);
  };
  return () => { globalThis.fetch = original; };
}
