/******************************************************************************/


import { BGGLookupError } from '../db/exceptions.js';
import { success, fail } from "./common.js";

import { insertGame, insertBGGGame,
         getGameList, getGameDetails, performGameLookup } from '../db/game.js';


/******************************************************************************/


/* Input:
 *   A JSON object of the form:
 *     {
 *       "bggId": 9216,
 *       "name": [],
 *       "slug",
 *       "published": 2004,
 *       "minPlayers": 2,
 *       "maxPlayers": 4,
 *       "minPlayerAge": 12,
 *       "playTime": 90,
 *       "minPlayTime": 90,
 *       "maxPlayTime": 90,
 *       "description": "",
 *       "thumbnail": "",
 *       "image": "",
 *       "complexity": 3.3717,
 *       "category": [],
 *       "mechanic": [],
 *       "designer": [],
 *       "artist": [],
 *       "publisher": []
 *     }
 *
 * This will insert a new game record into the database based on the passed in
 * data, including adding name records, adding in any of the metadata fields
 * that are not already present, and updating the placement of those items so
 * that the full game record is available. */
export async function insertGameReq(ctx) {
  // Suck in the new game data and use it to do the insert; the helper
  // function does all of the validation, and will throw on error or return
  // details of the new game on success.
  const gameData = await ctx.req.json();
  const newGameInfo = await insertGame(ctx, gameData);

  // Return success back.
  return success(ctx, `added game ${newGameInfo.id}`, newGameInfo);
}


/******************************************************************************/


/* Input: a bggGameId in the URL that represents the ID of a game from
 * BoardGameGeek that we want to insert.
 *
 * This will look up the data for the game and use it to perform the insertion
 * directly.
 *
 * The result of this query is the same as adding a game by providing an
 * explicit body. */
export async function insertBGGGameReq(ctx) {
  const { bggGameId } = ctx.req.param();

  const newGameInfo = await insertBGGGame(ctx, bggGameId);
  if (newGameInfo === null) {
    return fail(ctx, `BGG has no record of game with ID ${bggGameId}`, 404);
  }

  // Return success back.
  return success(ctx, `added game ${newGameInfo.id}`, newGameInfo);
}


/******************************************************************************/


/* Input: a bggGameId in the URL that represents the ID of a game from
 * BoardGameGeek that we want to insert.
 *
 * This will look up the data for the game and use it to perform the insertion
 * directly.
 *
 * The result of this query is the same as adding a game by providing an
 * explicit body. */
export async function insertBGGGameListReq(ctx) {
  // Suck in the new game data and use it to do the insert; the helper
  // function does all of the validation, and will throw on error or return
  // details of the new game on success.
  const gameList = await ctx.req.json();

  // Track which of the games we loop over was added and which was inserted.
  const inserted = [];
  const skipped = []
  const result = { inserted, skipped };

  // Loop over all of the BGG id's in the game list and try to insert them.
  for (const bggGameId of gameList) {
    try {
      // Try to lookup and insert this game; the result is either null if
      // there was a failure, or information on the inserted game.
      const newGameInfo = await insertBGGGame(ctx, bggGameId);
      if (newGameInfo === null) {
        skipped.push({ "bggId": bggGameId, status: 404, reason: "not found" });
      } else {
        inserted.push(newGameInfo);
      }
    }

    // If the insert threw any errors, handle them. If they are BGG lookup
    // failures, we can eat them and just skip this. Otherwise, we need to
    // re-throw so the outer handler can handle the problem for us.
    catch (err) {
      if (err instanceof BGGLookupError) {
        skipped.push({ "bggId": bggGameId, status: err.status, reason: "ID or slug already exists" });
        continue;
      }

      throw err;
    }
  }

  // Return success back.
  return success(ctx, `inserted ${inserted.length} games of ${gameList.length}`, result);
}


/******************************************************************************/


/* Return back a list of all of the metadata items of the given type; this may
 * be an empty list. */
export async function gameListReq(ctx) {
  const result = await getGameList(ctx);

  return success(ctx, `found ${result.length} games`, result);
}


/******************************************************************************/


/* Takes as a body an array of values that are either gameId values or game slug
 * names, and returns back a list of objects that tell you the id and slug
 * values for all matched games. */
export async function performGameLookupReq(ctx) {
  const filterList = await ctx.req.json();
  if (Array.isArray(filterList) === false) {
    return fail(ctx, 'request body should be an array of ids or slugs');
  }

  const result = await performGameLookup(ctx, filterList);
  return success(ctx, `looked up ${result.length} games`, result);
}


/******************************************************************************/


/* Return back a list of all of the metadata items of the given type; this may
 * be an empty list. */
export async function gameDetailsReq(ctx) {
  // Can be either an game ID or a slug to represent a game
  const { idOrSlug } = ctx.req.param();

  // Look up the game; if we don't find anything by that value, then this does
  // not exist.
  const result = await getGameDetails(ctx, idOrSlug);
  if (result === null) {
    return fail(ctx, `no such game ${idOrSlug}`, 404)
  }

  return success(ctx, `information on game ${idOrSlug}`, result);
}


/******************************************************************************/
