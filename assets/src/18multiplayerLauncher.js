/**
 * MultiplayerLauncher.js
 * Initializes multiplayer mode and patches the game strike function.
 * Load this AFTER boot.js
 */

(function() {
  let mpAdapter = null;
  let socket = null;
  let originalStrikeFunction = null;

  // Wait for game to be ready
  function waitForGame(callback, attempts = 0) {
    if (attempts > 100) {
      console.error('[MP] Game failed to initialize');
      return;
    }
    
    if (typeof game !== 'undefined' && game.state && game.state.current) {
      callback();
    } else {
      setTimeout(() => waitForGame(callback, attempts + 1), 100);
    }
  }

  function patchGameForMultiplayer() {
    // After game starts, patch the strike function
    waitForGame(() => {
      console.log('[MP] Game initialized, ready for multiplayer');
      
      // Expose init function for React/external callers
      window.initMultiplayer = function(socketInstance, playerId, serverUrl) {
        socket = socketInstance;
        
        // Get gameInfo from current playState
        if (typeof playState !== 'undefined' && playState.gameInfo) {
          const gameInfo = playState.gameInfo;
          gameInfo.players = [playerId, 'opponent']; // Placeholder opponents
          gameInfo.p1TargetType = 'ANY';
          gameInfo.p2TargetType = 'ANY';
          
          // Initialize adapter
          if (typeof MultiplayerAdapter !== 'undefined') {
            MultiplayerAdapter.init(socket, gameInfo, playerId);
            mpAdapter = MultiplayerAdapter;
            console.log('[MP] Adapter initialized');
          }
        }
      };

      // Expose strike interceptor
      window.multiplayerStrike = function(gameInfo, aimVector, power) {
        if (mpAdapter && mpAdapter.isEnabled()) {
          if (!mpAdapter.isPlayerTurn()) {
            console.log('[MP] Not your turn!');
            return false;
          }
          
          // Calculate angle from vector
          const angle = Math.atan2(aimVector.y, aimVector.x);
          mpAdapter.sendStrike(angle, power);
          console.log('[MP] Sent strike:', angle, power);
          return true;
        }
        return false; // Use local strike
      };

      // Expose match start
      window.startMultiplayerMatch = function() {
        if (mpAdapter) {
          mpAdapter.startMatch();
        }
      };

      console.log('[MP] Launcher ready');
    });
  }

  // Start patching when script loads
  patchGameForMultiplayer();
})();
