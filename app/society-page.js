'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Users, CalendarDays, Trophy, Shuffle, Wallet, Share2, Plus, Check,
  Star, ChevronLeft, Trash2, Loader2, Target, Award, LogOut, LogIn, Hand,
  Handshake, Shield, MessageCircle, Camera, UserRound, Layers, Copy, Settings, X
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { NATIONALITIES, countryFlag } from '../lib/countries';
import PositionTags from '../components/players/PositionTags';
import GameChat from '../components/chat/GameChat';
import { drawTeams, isGoalkeeper as isGoleiro, physicalScore } from '../lib/domain/game';
import { averageRatingFor as avgRatingFor, computeGameHighlights as computeGameDestaques, computeRanking } from '../lib/domain/ranking';
import { formatDatePtBr, WEEKDAY_LABELS, nextDateForWeekday, money, gameLocationQuery, gameMapUrls } from '../lib/ui/society-formatters';
import { addGameParticipant, removeGameParticipant, toggleGameWaitlist, setGameCost, setGameGoalkeeperPays, setGamePixDetails as serviceSetGamePixDetails, setGameOrganizer as serviceSetGameOrganizer, setGameLocation as serviceSetGameLocation, setGameMaxPlayers, setGameTeams, setGamePayment, setPlayerStats, setGameResult, setGameGoals, setGameRatings, createGame as serviceCreateGame, deleteGame as serviceDeleteGame, confirmOrganizer as serviceConfirmOrganizer, createGroup as serviceCreateGroup, addGroupMember as serviceAddGroupMember, createGroupLocation as serviceCreateGroupLocation, updateGroupLocation as serviceUpdateGroupLocation, deleteGroupLocation as serviceDeleteGroupLocation, setGroupDefaultLocation as serviceSetGroupDefaultLocation, setGroupDefaults as serviceSetGroupDefaults, leaveGroup as serviceLeaveGroup, removeGroupMember as serviceRemoveGroupMember, deleteGroup as serviceDeleteGroup, addGameGuest as serviceAddGameGuest, joinGameByToken as serviceJoinGameByToken, joinGroupByToken as serviceJoinGroupByToken, updateMyProfile as serviceUpdateMyProfile, setAdmin as serviceSetAdmin, uploadProfileAvatar as serviceUploadProfileAvatar, uploadGroupImage as serviceUploadGroupImage } from '../lib/services/society-service';
