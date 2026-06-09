import { db } from '../firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, serverTimestamp, increment, runTransaction
} from 'firebase/firestore';

function uid() {
  return doc(collection(db, '_')).id;
}

export const usersCol = () => collection(db, 'users');
export const userDoc = (id) => doc(db, 'users', id);

export const leaguesCol = () => collection(db, 'leagues');
export const leagueDoc = (id) => doc(db, 'leagues', id);
export const leagueMembersCol = (leagueId) => collection(db, 'leagues', leagueId, 'members');
export const leagueMemberDoc = (leagueId, userId) => doc(db, 'leagues', leagueId, 'members', userId);

export const teamsCol = () => collection(db, 'teams');
export const teamDoc = (id) => doc(db, 'teams', id);
export const teamPlayersCol = (teamId) => collection(db, 'teams', teamId, 'players');
export const teamPlayerDoc = (teamId, playerId) => doc(db, 'teams', teamId, 'players', playerId);

export const seasonsCol = () => collection(db, 'seasons');
export const seasonDoc = (id) => doc(db, 'seasons', id);
export const seasonGamesCol = (seasonId) => collection(db, 'seasons', seasonId, 'games');
export const seasonGameDoc = (seasonId, gameId) => doc(db, 'seasons', seasonId, 'games', gameId);
export const gameStatsCol = (seasonId, gameId) => collection(db, 'seasons', seasonId, 'games', gameId, 'stats');

export const tradesCol = () => collection(db, 'trades');
export const tradeDoc = (id) => doc(db, 'trades', id);

export const leagueNewsCol = (leagueId) => collection(db, 'leagues', leagueId, 'news');
export const leagueNewsDoc = (leagueId, newsId) => doc(db, 'leagues', leagueId, 'news', newsId);

export const storeItemsCol = () => collection(db, 'store');
export const storeItemDoc = (id) => doc(db, 'store', id);
export const userInventoryCol = (userId) => collection(db, 'users', userId, 'inventory');
export const userInventoryDoc = (userId, itemId) => doc(db, 'users', userId, 'inventory', itemId);

export const championshipsCol = (leagueId) => collection(db, 'leagues', leagueId, 'championships');
export const championshipDoc = (leagueId, id) => doc(db, 'leagues', leagueId, 'championships', id);

export const draftsCol = (leagueId) => collection(db, 'leagues', leagueId, 'drafts');
export const draftDoc = (leagueId, draftId) => doc(db, 'leagues', leagueId, 'drafts', draftId);
export const draftPicksCol = (leagueId, draftId) => collection(db, 'leagues', leagueId, 'drafts', draftId, 'picks');
export const draftPickDoc = (leagueId, draftId, pickId) => doc(db, 'leagues', leagueId, 'drafts', draftId, 'picks', pickId);

export const seasonPassesCol = (userId) => collection(db, 'users', userId, 'passes');
export const seasonPassDoc = (userId, passId) => doc(db, 'users', userId, 'passes', passId);

export { uid, serverTimestamp, increment };
