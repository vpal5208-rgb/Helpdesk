export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Rewrite pretty paths to static files if necessary
    let pathname = url.pathname;
    if (pathname === '/portal' || pathname === '/portal/') {
      pathname = '/portal.html';
    } else if (pathname === '/index' || pathname === '/index/') {
      pathname = '/index.html';
    }
    
    // Construct the target URL pointing to GitHub Pages
    const targetBase = 'https://vpal5208-rgb.github.io/Helpdesk';
    const targetUrl = targetBase + pathname + url.search;
    
    // Fetch the asset from GitHub Pages
    const response = await fetch(targetUrl, {
      headers: request.headers,
      redirect: 'follow'
    });
    
    // Clone headers to make them mutable
    const newHeaders = new Headers(response.headers);
    
    // Override Cache-Control headers to force fresh fetches
    newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    newHeaders.set('Pragma', 'no-cache');
    newHeaders.set('Expires', '0');
    
    // Return response with bypassed cache control
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
