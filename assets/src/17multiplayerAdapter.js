/**
 * MultiplayerAdapter.js
 * Bridges old Phaser game with Socket.io multiplayer server.
 * Reuses existing Phaser UI (cue, power bar, guide) and rendering.
 */

const MultiplayerAdapter = (function() {
  let socket = null;
  let gameInfo = null;
  let isMultiplayer = false;
  let currentSessionId = null;
  let currentPlayerId = null;
  let originalStrike = null;

  function init(socketInstance, gameInfoRef, playerId) {
    socket = socketInstance;
    gameInfo = gameInfoRef;
    currentPlayerId = playerId;
    isMultiplayer = true;

    console.log('[MP] Initialized with playerId:', playerId);

    // Disable local physics when multiplayer active
    if (gameInfo.phys && gameInfo.phys.updatePhysics) {
      gameInfo.phys._updatePhysics = gameInfo.phys.updatePhysics;
      gameInfo.phys.updatePhysics = function() {
        // Only update if not multiplayer or if we're in trial mode
        if (!isMultiplayer || gameInfo.trial) {
          this._updatePhysics();
        }
      };
    }

    setupSocketListeners();
  }

  function setupSocketListeners() {
    socket.on('game_state', (state) => {
      syncGameState(state);
    });

    socket.on('player_disconnected', ({ playerId }) => {
      console.log('[MP] Player disconnected:', playerId);
    });

    socket.on('start_match', ({ sessionId, turnTimeout }) => {
      currentSessionId = sessionId;
      gameInfo.turnTimeout = turnTimeout;
      gameInfo.gameRunning = true;
      gameInfo.turn = gameInfo.players[0];
      console.log('[MP] Match started:', sessionId);
    });

    socket.on('match_found', ({ sessionId, opponentId }) => {
      currentSessionId = sessionId;
      console.log('[MP] Match found:', sessionId, 'opponent:', opponentId);
      socket.emit('join_session', { sessionId });
    });

    socket.on('turn_timed_out', ({ nextTurn }) => {
      gameInfo.turn = nextTurn;
      console.log('[MP] Turn timed out, next:', nextTurn);
    });

    socket.on('reconnect_to_session', ({ sessionId }) => {
      currentSessionId = sessionId;
      console.log('[MP] Reconnecting to session:', sessionId);
    });
  }

  function syncGameState(state) {
    if (!gameInfo || !state) return;

    // Sync ball positions from server
    for (let i = 0; i < state.balls.length; i++) {
      const serverBall = state.balls[i];
      const localBall = gameInfo.ballArray.find(b => b && b.id === serverBall.id);
      
      if (localBall && localBall.active) {
        localBall.position.x = serverBall.x;
        localBall.position.y = serverBall.y;
        localBall.velocity.x = serverBall.vx;
        localBall.velocity.y = serverBall.vy;
      }
    }

    // Sync cue ball
    if (state.cueBall && gameInfo.ballArray[0]) {
      gameInfo.ballArray[0].position.x = state.cueBall.x;
      gameInfo.ballArray[0].position.y = state.cueBall.y;
      gameInfo.ballArray[0].velocity.x = state.cueBall.vx;
      gameInfo.ballArray[0].velocity.y = state.cueBall.vy;
    }

    // Handle pocketed balls
    if (state.pottedBalls && state.pottedBalls.length > 0) {
      for (const potted of state.pottedBalls) {
        const ball = gameInfo.ballArray.find(b => b && b.id === potted.ballId);
        if (ball && ball.active) {
          ball.active = false;
          ball.mc.visible = false;
          ball.shadow.visible = false;
          if (!gameInfo.pottedBallArray.includes(potted.ballId)) {
            gameInfo.pottedBallArray.push(potted.ballId);
            gameInfo.ballsPotted++;
          }
        }
      }
    }

    // Update turn indicator
    if (gameInfo.turn !== state.turn) {
      gameInfo.turn = state.turn;
      if (gameInfo.turnArrow1 && gameInfo.turnArrow2) {
        if (state.turn === gameInfo.players[0]) {
          gameInfo.turnArrow1.frame = 1;
          gameInfo.turnArrow2.frame = 0;
        } else {
          gameInfo.turnArrow1.frame = 0;
          gameInfo.turnArrow2.frame = 1;
        }
      }
    }

    // Render using existing system
    if (typeof renderScreen === 'function') {
      renderScreen();
    }
  }

  function sendStrike(angle, power) {
    if (!socket || !currentSessionId) {
      console.error('[MP] Socket not ready');
      return;
    }
    socket.emit('player_action', {
      type: 'strike',
      angle,
      power
    });
  }

  function startMatch() {
    if (socket) {
      socket.emit('find_match');
      console.log('[MP] Finding match...');
    }
  }

  function isPlayerTurn() {
    return gameInfo && gameInfo.turn === currentPlayerId;
  }

  function canStrike() {
    return isMultiplayer ? isPlayerTurn() : true;
  }

  return {
    init,
    sendStrike,
    startMatch,
    isPlayerTurn,
    canStrike,
    isEnabled: () => isMultiplayer,
    getSessionId: () => currentSessionId,
    getPlayerId: () => currentPlayerId,
    getSocket: () => socket
  };
})();
