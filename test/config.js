module.exports = {
  title: 'thejub.pub',
  mongodb_endpoint: 'mongodb://localhost',
  mongodb_db: 'jub-dj-dev',
  google_api_server_key: 'AIzaSyAn4jI9fRs2i4A9Wvnfwx_XJ6m9rnUw4I0',
  google_api_browser_key: 'AIzaSyAn4jI9fRs2i4A9Wvnfwx_XJ6m9rnUw4I0',
  auth: {
    token_len: '20'
  },
  latest_updates: {
    date: '2015-01-01',
    list: [
      'Update 1',
      'Update 2'
    ]
  },
  private_route: '/test_private_route',
  moved_message: "Ask for the new URL!",
  chat: {
    cache_dir: 'test/chat_cache',
    cache_limit: 1000,
  }
}
