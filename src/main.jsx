import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Camera,
  ChevronDown,
  Headphones,
  Hash,
  HelpCircle,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  Paperclip,
  PhoneCall,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  Speaker,
  Users,
  Video,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import './styles.css';
import { isSupabaseConfigured, supabase } from './supabase';

// A instalação começa vazia. Comunidades, canais, membros e mensagens vêm do Supabase.
const initialMessages = [];
const members = [];
const channels = [];
const rtcIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL ? [{ urls: import.meta.env.VITE_TURN_URL, username: import.meta.env.VITE_TURN_USERNAME || '', credential: import.meta.env.VITE_TURN_CREDENTIAL || '' }] : [])
];

const emojiOptions = ['😀', '😂', '😍', '😎', '🥳', '😢', '😡', '🤔', '👍', '👎', '👏', '🙏', '🔥', '❤️', '🎉', '🚀', '💡', '✅', '👀', '💬', '🐶', '🐱', '🍕', '☕'];
const presenceOptions = [
  { id: 'online', label: 'Online', description: 'Você está disponível', color: 'green' },
  { id: 'idle', label: 'Ausente', description: 'Você está temporariamente ausente', color: 'gray' },
  { id: 'offline', label: 'Offline', description: 'Aparecerá desconectado', color: 'red' }
];
const presenceLabel = (presence) => presenceOptions.find((item) => item.id === presence)?.label || 'Online';

function playVoiceTone(kind = 'join') {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const now = audio.currentTime;
    oscillator.type = 'sine';
    const startFrequency = kind === 'join' ? 620 : kind === 'mute' ? 330 : 420;
    const endFrequency = kind === 'join' ? 880 : kind === 'mute' ? 220 : 260;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
    oscillator.addEventListener('ended', () => audio.close());
  } catch {
    // Alguns ambientes podem bloquear áudio até a primeira interação do usuário.
  }
}

function Avatar({ initials, color, online = false, small = false, image = '', presence = '', speaking = false }) {
  const resolvedPresence = presence || (online ? 'online' : 'offline');
  return (
    <span className={`avatar avatar-${color} ${small ? 'avatar-small' : ''} ${image ? 'avatar-image' : ''} ${speaking ? 'avatar-speaking' : ''}`}>
      {image ? <img src={image} alt="" /> : initials}
      {(online || presence) && <span className={`online-dot presence-${resolvedPresence}`} />}
    </span>
  );
}

function App() {
  const [selectedChannel, setSelectedChannel] = useState('geral');
  const [viewMode, setViewMode] = useState('community');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const audioRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingLevelsRef = useRef([]);
  const recordingAnalysisRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const voiceChannelRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState(() => localStorage.getItem('amigos_presence_status') || 'online');
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [shareSources, setShareSources] = useState([]);
  const [shareSourceId, setShareSourceId] = useState('screen:0:0');
  const [shareQuality, setShareQuality] = useState('720p');
  const [screenStream, setScreenStream] = useState(null);
  const [microphoneStream, setMicrophoneStream] = useState(null);
  const screenPreviewRef = useRef(null);
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState(null);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const rtcPeersRef = useRef({});
  const rtcAudioRef = useRef({});
  const [rtcReady, setRtcReady] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [communityFriendInvites, setCommunityFriendInvites] = useState([]);
  const [friendStatus, setFriendStatus] = useState('');
  const [communityFriendInviteStatus, setCommunityFriendInviteStatus] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [communityInvite, setCommunityInvite] = useState('');
  const [showChannelCreator, setShowChannelCreator] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [roleMember, setRoleMember] = useState(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('text');
  const [customChannels, setCustomChannels] = useState([]);
  const [remoteChannels, setRemoteChannels] = useState([]);
  const [remoteMembers, setRemoteMembers] = useState([]);
  const [communityId, setCommunityId] = useState(null);
  const [communityList, setCommunityList] = useState([]);
  const [mutedCommunities, setMutedCommunities] = useState(() => {
    try { return JSON.parse(localStorage.getItem('amigos_muted_communities') || '{}'); } catch { return {}; }
  });
  const [communityMenu, setCommunityMenu] = useState(null);
  const [communityOwnerId, setCommunityOwnerId] = useState(null);
  const [communityName, setCommunityName] = useState('Amigos');
  const [showCommunityCreator, setShowCommunityCreator] = useState(false);
  const [showCommunitySettings, setShowCommunitySettings] = useState(false);
  const [communitySettingsName, setCommunitySettingsName] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [remoteReady, setRemoteReady] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [membershipAccessLost, setMembershipAccessLost] = useState(false);
  const [communityReload, setCommunityReload] = useState(0);
  const [currentRole, setCurrentRole] = useState('Membro');
  const [volumeByUser, setVolumeByUser] = useState({});
  const [localMutedUsers, setLocalMutedUsers] = useState({});
  const [localDeafenedUsers, setLocalDeafenedUsers] = useState({});
  const [volumeEditor, setVolumeEditor] = useState(null);
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedInput, setSelectedInput] = useState(() => localStorage.getItem('amigos_audio_input') || 'default');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('amigos_audio_output') || 'default');
  const [masterVolume, setMasterVolume] = useState(() => Number(localStorage.getItem('amigos_master_volume') || 100));
  const [micSensitivity, setMicSensitivity] = useState(() => Number(localStorage.getItem('amigos_mic_sensitivity') || 55));
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [profileAvatarDraft, setProfileAvatarDraft] = useState('');
  const [profileOverride, setProfileOverride] = useState(null);
  const [moderationMenu, setModerationMenu] = useState(null);
  const [serverMuted, setServerMuted] = useState({});
  const [serverDeafened, setServerDeafened] = useState({});
  const [disconnectedUsers, setDisconnectedUsers] = useState({});
  const [channelMenu, setChannelMenu] = useState(null);
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelEditName, setChannelEditName] = useState('');
  const [roles, setRoles] = useState(['Organizador', 'Moderador', 'Membro']);
  const [memberRoles, setMemberRoles] = useState({});
  const [session, setSession] = useState(null);
  const [localUser, setLocalUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('amigos_local_user') || 'null'); } catch { return null; }
  });
  const [authMode, setAuthMode] = useState('signup');
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [notice, setNotice] = useState('');

  const activeUser = session?.user ? {
    id: session.user.id,
    email: session.user.email,
    name: profileOverride?.name || session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Você',
    avatar_url: profileOverride?.avatar_url || session.user.user_metadata?.avatar_url || ''
  } : localUser;
  const allChannels = useMemo(() => remoteReady ? remoteChannels : (session?.user?.id ? [] : [...channels, ...customChannels]), [customChannels, remoteChannels, remoteReady, session?.user?.id]);
  const channel = useMemo(
    () => allChannels.find((item) => item.id === selectedChannel) ?? allChannels[0] ?? { id: null, label: 'sem-canal', description: 'Crie ou entre em uma comunidade para começar.' },
    [allChannels, selectedChannel]
  );
  const isAdmin = communityOwnerId === activeUser?.id || ['Organizador', 'Administrador', 'Moderador'].includes(currentRole);
  const canKick = communityOwnerId === activeUser?.id || ['Organizador', 'Administrador'].includes(currentRole);
  const selectedVoiceUserIsSelf = moderationMenu?.member?.id === activeUser?.id || moderationMenu?.member?.name === activeUser?.name || moderationMenu?.member?.name === 'Você';
  const communityRailItems = communityList;
  const presenceColor = presenceStatus === 'offline' ? 'red' : presenceStatus === 'idle' ? 'gray' : 'green';
  const displayMembers = useMemo(() => remoteMembers.map((member) => {
    const isSelf = member.id === session?.user?.id;
    const inVoice = voiceParticipants.some((participant) => participant.id === member.id);
    const presence = isSelf ? presenceStatus : inVoice ? 'online' : 'offline';
    return { ...member, presence, online: presence !== 'offline' };
  }), [remoteMembers, session?.user?.id, presenceStatus, voiceParticipants]);

  async function loadCommunityMembers(targetCommunityId) {
    if (!supabase || !targetCommunityId) {
      setRemoteMembers([]);
      return [];
    }
    const { data, error } = await supabase
      .from('community_members')
      .select('user_id,role,profiles(id,display_name,avatar_color,avatar_url)')
      .eq('community_id', targetCommunityId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    const normalized = (data || []).map((membership) => {
      const profile = membership.profiles || {};
      const name = profile.display_name || 'Membro';
      return {
        id: membership.user_id,
        name,
        initials: name.slice(0, 2).toUpperCase(),
        color: profile.avatar_color || 'blue',
        avatar_url: profile.avatar_url || '',
        role: membership.role || 'Membro',
        status: membership.role || 'Membro',
        presence: membership.user_id === session?.user?.id ? presenceStatus : 'offline',
        online: membership.user_id === session?.user?.id && presenceStatus !== 'offline'
      };
    });
    setRemoteMembers(normalized);
    setMemberRoles(Object.fromEntries(normalized.map((member) => [member.name, member.role])));
    return normalized;
  }

  function clearCommunityAccess(message = '') {
    microphoneStream?.getTracks().forEach((track) => track.stop());
    setMicrophoneStream(null);
    setVoiceJoined(false);
    setVoiceChannelId(null);
    setVoiceParticipants([]);
    setCommunityList([]);
    setCommunityId(null);
    setCommunityName('Sem comunidade');
    setCommunityOwnerId(null);
    setCurrentRole('Membro');
    setRemoteChannels([]);
    setRemoteMembers([]);
    setMessages([]);
    setRemoteReady(false);
    if (message) showNotice(message);
  }

  async function refreshAudioDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());
    } catch {
      // O usuário poderá escolher os dispositivos depois de conceder permissão.
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    setAudioInputs(devices.filter((device) => device.kind === 'audioinput'));
    setAudioOutputs(devices.filter((device) => device.kind === 'audiooutput'));
  }

  function chooseAudioInput(deviceId) {
    setSelectedInput(deviceId);
    localStorage.setItem('amigos_audio_input', deviceId);
  }

  async function chooseAudioOutput(deviceId) {
    setSelectedOutput(deviceId);
    localStorage.setItem('amigos_audio_output', deviceId);
    if (screenPreviewRef.current?.setSinkId) {
      try { await screenPreviewRef.current.setSinkId(deviceId); } catch { /* saída não suportada pelo dispositivo */ }
    }
  }

  function toggleCommunityMuted(targetCommunity) {
    const next = { ...mutedCommunities, [targetCommunity.id]: !mutedCommunities[targetCommunity.id] };
    setMutedCommunities(next);
    localStorage.setItem('amigos_muted_communities', JSON.stringify(next));
    setCommunityMenu(null);
    showNotice(`${targetCommunity.name} ${next[targetCommunity.id] ? 'silenciada' : 'com notificações ativadas'}.`);
  }

  async function leaveOrDeleteCommunity(targetCommunity, mode = 'leave') {
    if (!supabase || !session?.user?.id || !targetCommunity?.id || targetCommunity.id === 'demo') {
      setCommunityMenu(null);
      showNotice('Essa ação exige uma comunidade online.');
      return;
    }
    const isOwner = targetCommunity.owner_id === session.user.id;
    if (mode === 'delete' && !isOwner) {
      setCommunityMenu(null);
      showNotice('Somente o proprietário pode excluir a comunidade.');
      return;
    }
    const actionLabel = mode === 'delete' ? 'excluir permanentemente' : 'sair de';
    const confirmed = window.confirm(`Tem certeza que deseja ${actionLabel} “${targetCommunity.name}”?`);
    if (!confirmed) { setCommunityMenu(null); return; }
    try {
      if (mode === 'delete') {
        const { error } = await supabase.from('communities').delete().eq('id', targetCommunity.id).eq('owner_id', session.user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('community_members').delete().eq('community_id', targetCommunity.id).eq('user_id', session.user.id);
        if (error) throw error;
      }
      const remaining = communityList.filter((item) => item.id !== targetCommunity.id);
      setCommunityList(remaining);
      const nextCommunity = remaining[0];
      setCommunityMenu(null);
      if (targetCommunity.id === communityId) {
        if (nextCommunity) await switchCommunity(nextCommunity);
        else {
          setCommunityId(null);
          setCommunityName('Sem comunidade');
          setCommunityOwnerId(null);
          setRemoteChannels([]);
          setRemoteReady(false);
          setMessages([]);
        }
      }
      showNotice(mode === 'delete' ? 'Comunidade excluída.' : 'Você saiu da comunidade.');
    } catch (error) {
      setCommunityMenu(null);
      showNotice(`Não foi possível ${mode === 'delete' ? 'excluir' : 'sair da'} comunidade: ${error.message}`);
    }
  }

  async function switchCommunity(nextCommunity) {
    if (!nextCommunity?.id || !supabase || !session?.user?.id) return;
    setViewMode('community');
    if (nextCommunity.id === communityId) return;
    setVoiceJoined(false);
    setVoiceChannelId(null);
    microphoneStream?.getTracks().forEach((track) => track.stop());
    setMicrophoneStream(null);
    setModerationMenu(null);
    setCommunityId(nextCommunity.id);
    setCommunityName(nextCommunity.name);
    setCommunityOwnerId(nextCommunity.owner_id);
    setCurrentRole(nextCommunity.role || 'Membro');
    setRemoteReady(false);
    setRemoteChannels([]);
    setCustomChannels([]);
    setMessages([]);
    localStorage.setItem(`amigos_active_community:${session.user.id}`, nextCommunity.id);
    try {
      let { data: cloudChannels, error: channelError } = await supabase.from('channels').select('id,name,type,description,position').eq('community_id', nextCommunity.id).order('position');
      if (channelError) throw channelError;
      const normalizedChannels = (cloudChannels || []).map((item) => ({ id: item.id, label: item.name, type: item.type, description: item.description }));
      setRemoteChannels(normalizedChannels);
      await loadCommunityMembers(nextCommunity.id);
      const firstTextChannel = normalizedChannels.find((item) => item.type === 'text');
      setSelectedChannel(firstTextChannel?.id || normalizedChannels[0]?.id || 'geral');
      if (firstTextChannel) {
        const { data: cloudMessages } = await supabase.from('messages').select('id,content,created_at,author_id,profiles(display_name,avatar_color)').eq('channel_id', firstTextChannel.id).order('created_at', { ascending: true }).limit(100);
        setMessages((cloudMessages || []).map((item) => ({ id: item.id, author: item.profiles?.display_name || 'Membro', initials: (item.profiles?.display_name || 'M').slice(0, 2).toUpperCase(), color: item.profiles?.avatar_color || 'blue', time: new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), text: item.content })));
      }
      setRemoteReady(true);
      setMembershipAccessLost(false);
      showNotice(`Você entrou em ${nextCommunity.name}.`);
    } catch {
      setRemoteReady(false);
      showNotice('Não foi possível carregar essa comunidade.');
    }
  }

  useEffect(() => {
    refreshAudioDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshAudioDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshAudioDevices);
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined;
    let alive = true;

    async function loadCloudCommunity() {
      try {
        const { data: memberships, error: membershipError } = await supabase
          .from('community_members')
          .select('community_id, role')
          .eq('user_id', session.user.id);
        if (membershipError) throw membershipError;

        const allMemberships = memberships || [];
        const savedCommunityId = localStorage.getItem(`amigos_active_community:${session.user.id}`);
        const currentMembership = allMemberships.find((item) => item.community_id === savedCommunityId) || allMemberships[0];
        const currentCommunityId = currentMembership?.community_id || null;
        if (!currentCommunityId) {
          if (!alive) return;
          setCloudLoading(false);
          clearCommunityAccess();
          setMembershipAccessLost(false);
          return;
        }
        const communityIds = allMemberships.map((item) => item.community_id);
        const { data: communityInfos, error: communityInfoError } = await supabase.from('communities').select('id,name,owner_id').in('id', communityIds);
        if (communityInfoError) throw communityInfoError;
        const normalizedCommunities = (communityInfos || []).map((item) => ({ ...item, role: allMemberships.find((membership) => membership.community_id === item.id)?.role || 'Membro' }));
        setCommunityList(normalizedCommunities);
        const membership = allMemberships.find((item) => item.community_id === currentCommunityId) || allMemberships[0];
        const communityInfo = normalizedCommunities.find((item) => item.id === currentCommunityId);
        if (!communityInfo) throw new Error('Comunidade não encontrada.');
        if (communityInfoError) throw communityInfoError;
        setCommunityName(communityInfo.name);
        setCommunityOwnerId(communityInfo.owner_id);
        const { data: profileData } = await supabase.from('profiles').select('display_name,avatar_url').eq('id', session.user.id).maybeSingle();
        if (profileData) setProfileOverride({ name: profileData.display_name, avatar_url: profileData.avatar_url || '' });

        let { data: cloudChannels, error: channelError } = await supabase
          .from('channels')
          .select('id,name,type,description,position')
          .eq('community_id', currentCommunityId)
          .order('position');
        if (channelError) throw channelError;
        if (!alive) return;
        const normalizedChannels = (cloudChannels || []).map((item) => ({ id: item.id, label: item.name, type: item.type, description: item.description }));
        setCommunityId(currentCommunityId);
        setCurrentRole(currentMembership?.role || 'Membro');
        setMembershipAccessLost(false);
        setRemoteChannels(normalizedChannels);
        await loadCommunityMembers(currentCommunityId);
        setSelectedChannel(normalizedChannels[0]?.id || 'geral');
        setRemoteReady(true);

        const firstTextChannel = normalizedChannels.find((item) => item.type === 'text');
        if (firstTextChannel) {
          const { data: cloudMessages } = await supabase
            .from('messages')
            .select('id,content,created_at,author_id,message_type,audio_url,duration_seconds,waveform,profiles(display_name,avatar_color)')
            .eq('channel_id', firstTextChannel.id)
            .order('created_at', { ascending: true })
            .limit(100);
          if (cloudMessages?.length) {
            setMessages(cloudMessages.map((item) => ({
              id: item.id,
              author: item.profiles?.display_name || 'Membro',
              initials: (item.profiles?.display_name || 'M').slice(0, 2).toUpperCase(),
              color: item.profiles?.avatar_color || 'blue',
              time: new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              text: item.content,
              type: item.message_type || 'text',
              audioUrl: item.audio_url || '',
              duration: item.duration_seconds || 0,
              waveform: item.waveform || []
            })));
          }
        }
      } catch (error) {
        if (!alive) return;
        setRemoteReady(false);
        setNotice('A conta entrou, mas o esquema do Supabase ainda precisa ser executado.');
      }
    }

    loadCloudCommunity();
    return () => { alive = false; };
  }, [session?.user?.id, communityReload]);

  useEffect(() => {
    if (!supabase || !session?.user?.id || !communityId) return undefined;
    let active = true;
    const verifyMembership = async () => {
      const { data: ownMembership } = await supabase
        .from('community_members')
        .select('community_id,role')
        .eq('community_id', communityId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      if (!ownMembership) {
        clearCommunityAccess('Você não faz mais parte desta comunidade.');
        return;
      }
      setCurrentRole(ownMembership.role || 'Membro');
      try { await loadCommunityMembers(communityId); } catch { /* próxima verificação tentará novamente */ }
    };
    const communitySync = supabase.channel(`community-sync:${communityId}:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members', filter: `community_id=eq.${communityId}` }, verifyMembership)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels', filter: `community_id=eq.${communityId}` }, async () => {
        const { data } = await supabase.from('channels').select('id,name,type,description,position').eq('community_id', communityId).order('position');
        if (active) setRemoteChannels((data || []).map((item) => ({ id: item.id, label: item.name, type: item.type, description: item.description })));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'communities', filter: `id=eq.${communityId}` }, (payload) => {
        if (active && payload.new?.name) {
          setCommunityName(payload.new.name);
          setCommunityList((current) => current.map((item) => item.id === communityId ? { ...item, name: payload.new.name } : item));
        }
      })
      .subscribe();
    const membershipTimer = window.setInterval(verifyMembership, 15000);
    verifyMembership();
    return () => {
      active = false;
      window.clearInterval(membershipTimer);
      supabase.removeChannel(communitySync);
    };
  }, [communityId, session?.user?.id]);

  useEffect(() => {
    if (!supabase || !remoteReady || !session?.user?.id || !channel?.id || channel.type !== 'text') return undefined;
    const messageChannel = supabase.channel(`messages:${channel.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` }, async (payload) => {
        const next = payload.new;
        const { data: authorProfile } = await supabase.from('profiles').select('display_name,avatar_color').eq('id', next.author_id).maybeSingle();
        setMessages((current) => {
          if (current.some((item) => item.id === next.id)) return current;
          const author = authorProfile?.display_name || (next.author_id === session.user.id ? (activeUser?.name || 'Você') : 'Membro');
          return [...current, {
            id: next.id,
            author,
            initials: author.slice(0, 2).toUpperCase(),
            color: authorProfile?.avatar_color || (next.author_id === session.user.id ? 'green' : 'blue'),
            time: new Date(next.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            text: next.content,
            type: next.message_type || 'text',
            audioUrl: next.audio_url || '',
            duration: next.duration_seconds || 0,
            waveform: next.waveform || []
          }];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(messageChannel); };
  }, [remoteReady, channel?.id, channel?.type, session?.user?.id, activeUser?.name]);

  useEffect(() => {
    if (!supabase || !remoteReady || !voiceJoined || !session?.user?.id) {
      voiceChannelRef.current = null;
      setVoiceParticipants([]);
      setRtcReady(false);
      Object.values(rtcPeersRef.current).forEach((peer) => peer.close());
      rtcPeersRef.current = {};
      Object.values(rtcAudioRef.current).forEach((audio) => audio.remove());
      rtcAudioRef.current = {};
      return undefined;
    }
    const activeVoiceChannelId = voiceChannelId || channel?.id || 'voice-default';
    const voiceChannel = supabase.channel(`voice:${communityId || 'community'}:${activeVoiceChannelId}`, {
      config: { presence: { key: session.user.id } }
    });
    voiceChannelRef.current = voiceChannel;

    const sendSignal = (target, signal) => voiceChannel.send({ type: 'broadcast', event: 'webrtc-signal', payload: { target, sender: session.user.id, signal } });
    const closePeer = (peerId) => {
      rtcPeersRef.current[peerId]?.close();
      delete rtcPeersRef.current[peerId];
      rtcAudioRef.current[peerId]?.remove();
      delete rtcAudioRef.current[peerId];
    };
    const ensurePeer = (peerId, initiator = false) => {
      if (!peerId || peerId === session.user.id) return null;
      if (rtcPeersRef.current[peerId]) return rtcPeersRef.current[peerId];
      const peer = new RTCPeerConnection({ iceServers: rtcIceServers });
      rtcPeersRef.current[peerId] = peer;
      microphoneStream?.getTracks().forEach((track) => peer.addTrack(track, microphoneStream));
      peer.onicecandidate = (event) => { if (event.candidate) sendSignal(peerId, { type: 'candidate', candidate: event.candidate }); };
      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        let audio = rtcAudioRef.current[peerId];
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.playsInline = true;
          audio.dataset.peerId = peerId;
          document.body.appendChild(audio);
          rtcAudioRef.current[peerId] = audio;
        }
        audio.srcObject = stream;
        audio.volume = deafened ? 0 : Math.max(0, Math.min(100, masterVolume)) / 100;
        if (audio.setSinkId && selectedOutput !== 'default') audio.setSinkId(selectedOutput).catch(() => {});
        audio.play().catch(() => {});
      };
      peer.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(peer.connectionState)) closePeer(peerId); };
      if (initiator) peer.createOffer().then((offer) => peer.setLocalDescription(offer).then(() => sendSignal(peerId, { type: 'offer', offer }))).catch(() => {});
      return peer;
    };

    voiceChannel.on('presence', { event: 'sync' }, () => {
      const state = voiceChannel.presenceState();
      const participants = Object.values(state).flat().map((item) => item.user).filter((user) => user && (!user.voice_channel_id || user.voice_channel_id === activeVoiceChannelId));
      setVoiceParticipants(participants);
      participants.filter((user) => user.id !== session.user.id).forEach((user) => {
        if (session.user.id < user.id) ensurePeer(user.id, true);
      });
    });
    voiceChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      (leftPresences || []).map((presence) => presence.user?.id).filter(Boolean).forEach(closePeer);
    });
    voiceChannel.on('broadcast', { event: 'webrtc-signal' }, async ({ payload }) => {
      if (!payload || payload.target !== session.user.id || payload.sender === session.user.id) return;
      const peer = ensurePeer(payload.sender, false);
      if (!peer) return;
      try {
        if (payload.signal.type === 'offer') {
          await peer.setRemoteDescription(payload.signal.offer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          sendSignal(payload.sender, { type: 'answer', answer });
        } else if (payload.signal.type === 'answer') {
          await peer.setRemoteDescription(payload.signal.answer);
        } else if (payload.signal.type === 'candidate') {
          await peer.addIceCandidate(payload.signal.candidate);
        }
      } catch { closePeer(payload.sender); }
    });
    voiceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await voiceChannel.track({ user: { id: session.user.id, name: activeUser?.name || 'Você', initials: (activeUser?.name || 'VC').slice(0, 2).toUpperCase(), color: 'green', avatar_url: activeUser?.avatar_url || '', voice_channel_id: activeVoiceChannelId, speaking: false } });
        setRtcReady(true);
      }
    });
    return () => {
      Object.values(rtcPeersRef.current).forEach((peer) => peer.close());
      rtcPeersRef.current = {};
      Object.values(rtcAudioRef.current).forEach((audio) => audio.remove());
      rtcAudioRef.current = {};
      supabase.removeChannel(voiceChannel);
      voiceChannelRef.current = null;
      setVoiceParticipants([]);
      setRtcReady(false);
    };
  }, [remoteReady, voiceJoined, voiceChannelId, communityId, channel?.id, session?.user?.id, activeUser?.name, activeUser?.avatar_url, microphoneStream]);

  useEffect(() => {
    if (!voiceJoined || !microphoneStream) {
      setVoiceSpeaking(false);
      return undefined;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    const source = audioContext.createMediaStreamSource(microphoneStream);
    const data = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    let frame;
    let lastSpeaking = false;
    const detect = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let index = 0; index < data.length; index += 1) {
        const sample = (data[index] - 128) / 128;
        sum += sample * sample;
      }
      const level = Math.sqrt(sum / data.length);
      const threshold = 0.13 - (Math.max(0, Math.min(100, micSensitivity)) / 100) * 0.1;
      const speaking = level > threshold && !muted && !deafened;
      if (speaking !== lastSpeaking) {
        lastSpeaking = speaking;
        setVoiceSpeaking(speaking);
        const nextUser = { id: session?.user?.id, name: activeUser?.name || 'Você', initials: (activeUser?.name || 'VC').slice(0, 2).toUpperCase(), color: 'green', avatar_url: activeUser?.avatar_url || '', voice_channel_id: voiceChannelId || channel?.id || 'voice-default', speaking };
        voiceChannelRef.current?.track({ user: nextUser });
      }
      frame = requestAnimationFrame(detect);
    };
    audioContext.resume().catch(() => {});
    detect();
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
      setVoiceSpeaking(false);
          voiceChannelRef.current?.track({ user: { id: session?.user?.id, name: activeUser?.name || 'Você', initials: (activeUser?.name || 'VC').slice(0, 2).toUpperCase(), color: 'green', avatar_url: activeUser?.avatar_url || '', voice_channel_id: voiceChannelId || channel?.id || 'voice-default', speaking: false } });
    };
  }, [voiceJoined, microphoneStream, muted, deafened, micSensitivity, voiceChannelId, channel?.id, session?.user?.id, activeUser?.name, activeUser?.avatar_url]);

  useEffect(() => {
    if (!screenPreviewRef.current || !screenStream) return undefined;
    screenPreviewRef.current.srcObject = screenStream;
    screenPreviewRef.current.play().catch(() => {});
    return () => { if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null; };
  }, [screenStream]);

  async function refreshSocialData() {
    if (!supabase || !session?.user?.id) return;
    const { data: relations, error } = await supabase
      .from('friendships')
      .select('id,status,requester_id,addressee_id,created_at,updated_at')
      .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`)
      .order('updated_at', { ascending: false });
    if (error || !relations) return;
    const ids = [...new Set(relations.flatMap((item) => [item.requester_id, item.addressee_id]))];
    const { data: profiles } = await supabase.from('profiles').select('id,display_name,avatar_color,avatar_url').in('id', ids);
    const byId = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
    const withProfiles = relations.map((item) => ({
      ...item,
      other: byId[item.requester_id === session.user.id ? item.addressee_id : item.requester_id] || { display_name: 'Membro' }
    }));
    setFriendsList(withProfiles.filter((item) => item.status === 'accepted'));
    setFriendRequests(withProfiles.filter((item) => item.status === 'pending' && item.addressee_id === session.user.id));
  }

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined;
    let active = true;
    refreshSocialData();
    refreshCommunityFriendInvites();
    const socialChannel = supabase.channel(`friendships:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        if (active) refreshSocialData();
      })
      .subscribe();
    const communityInviteChannel = supabase.channel(`community-friend-invites:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_friend_invites' }, () => {
        if (active) refreshCommunityFriendInvites();
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(socialChannel);
      supabase.removeChannel(communityInviteChannel);
    };
  }, [session?.user?.id]);

  async function sendFriendRequest() {
    const target = friendSearch.trim();
    if (!target) return;
    if (!supabase || !session?.user?.id) {
      setFriendStatus('O Supabase precisa estar conectado para adicionar amigos.');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('id,display_name').ilike('display_name', target).maybeSingle();
    if (!profile) {
      setFriendStatus('Nenhum usuário encontrado com esse nome exato.');
      return;
    }
    if (profile.id === session.user.id) {
      setFriendStatus('Você não pode enviar uma solicitação para si mesmo.');
      return;
    }
    const { data: existing } = await supabase.from('friendships').select('id,status,requester_id,addressee_id').or(`and(requester_id.eq.${session.user.id},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${session.user.id})`).maybeSingle();
    if (existing?.status === 'accepted') {
      setFriendStatus(`${profile.display_name} já está na sua lista de amigos.`);
      return;
    }
    if (existing?.status === 'pending') {
      setFriendStatus('Já existe uma solicitação pendente entre vocês.');
      return;
    }
    const { error } = await supabase.from('friendships').insert({ requester_id: session.user.id, addressee_id: profile.id });
    setFriendStatus(error ? `Não foi possível enviar a solicitação: ${error.message}` : `Solicitação enviada para ${profile.display_name}.`);
    if (!error) { setFriendSearch(''); await refreshSocialData(); }
  }

  async function respondToFriendRequest(request, status) {
    if (!supabase || !session?.user?.id) return;
    const { error } = await supabase.from('friendships').update({ status, updated_at: new Date().toISOString() }).eq('id', request.id).eq('addressee_id', session.user.id);
    if (error) {
      setFriendStatus(`Não foi possível atualizar a solicitação: ${error.message}`);
      return;
    }
    await refreshSocialData();
    setFriendStatus(status === 'accepted' ? `Agora você e ${request.other?.display_name || 'seu amigo'} são amigos.` : 'Solicitação recusada.');
  }

  async function refreshCommunityFriendInvites() {
    if (!supabase || !session?.user?.id) return;
    const { data: invites, error } = await supabase
      .from('community_friend_invites')
      .select('id,community_id,inviter_id,invitee_id,status,created_at,updated_at')
      .eq('invitee_id', session.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error || !invites?.length) {
      setCommunityFriendInvites([]);
      return;
    }
    const communityIds = [...new Set(invites.map((invite) => invite.community_id))];
    const inviterIds = [...new Set(invites.map((invite) => invite.inviter_id))];
    const [{ data: communities }, { data: profiles }] = await Promise.all([
      supabase.from('communities').select('id,name,owner_id').in('id', communityIds),
      supabase.from('profiles').select('id,display_name,avatar_color,avatar_url').in('id', inviterIds)
    ]);
    const communitiesById = Object.fromEntries((communities || []).map((community) => [community.id, community]));
    const profilesById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
    setCommunityFriendInvites(invites.map((invite) => ({ ...invite, community: communitiesById[invite.community_id] || { id: invite.community_id, name: 'Comunidade' }, inviter: profilesById[invite.inviter_id] || { id: invite.inviter_id, display_name: 'Amigo' } })));
  }

  async function sendCommunityFriendInvite(friend) {
    const friendId = friend?.other?.id || friend?.id;
    if (!supabase || !session?.user?.id || !communityId || !friendId) return;
    const { error } = await supabase.rpc('send_community_friend_invite', { target_community: communityId, target_friend: friendId });
    if (error) {
      setCommunityFriendInviteStatus(`Não foi possível convidar ${friend?.other?.display_name || 'este amigo'}: ${error.message}`);
      return;
    }
    setCommunityFriendInviteStatus(`Convite enviado para ${friend?.other?.display_name || 'seu amigo'}.`);
  }

  async function respondToCommunityFriendInvite(invite, status) {
    if (!supabase || !session?.user?.id) return;
    const { data, error } = await supabase.rpc('respond_to_community_friend_invite', { target_invite: invite.id, next_status: status });
    if (error) {
      setCommunityFriendInviteStatus(`Não foi possível responder ao convite: ${error.message}`);
      return;
    }
    await refreshCommunityFriendInvites();
    if (status === 'accepted') {
      setCommunityReload((current) => current + 1);
      setCommunityFriendInviteStatus(`Você entrou em ${data?.[0]?.community_name || invite.community?.name || 'uma comunidade'}.`);
    } else {
      setCommunityFriendInviteStatus('Convite recusado.');
    }
  }

  function openLobby() {
    setViewMode('lobby');
    setSelectedFriend(null);
    setDraft('');
  }

  async function openDirectChat(friend) {
    const friendId = friend?.other?.id || friend?.id;
    if (!friendId || !session?.user?.id || !supabase) return;
    setSelectedFriend(friend);
    setViewMode('dm');
    setDraft('');
    const { data } = await supabase
      .from('direct_messages')
      .select('id,sender_id,recipient_id,content,created_at')
      .or(`and(sender_id.eq.${session.user.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${session.user.id})`)
      .order('created_at', { ascending: true })
      .limit(200);
    setDirectMessages(data || []);
  }

  async function sendDirectMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    const friendId = selectedFriend?.other?.id || selectedFriend?.id;
    if (!content || !friendId || !supabase || !session?.user?.id) return;
    let { data, error } = await supabase.rpc('send_direct_message', { target_recipient: friendId, message_content: content });
    if (error) {
      const fallback = await supabase.from('direct_messages').insert({ sender_id: session.user.id, recipient_id: friendId, content }).select('id,sender_id,recipient_id,content,created_at').single();
      data = fallback.data;
      error = fallback.error;
    }
    const message = Array.isArray(data) ? data[0] : data;
    if (error || !message) {
      showNotice(`Não foi possível enviar a mensagem privada: ${error?.message || 'resposta vazia do servidor'}`);
      return;
    }
    setDirectMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    setDraft('');
  }

  useEffect(() => {
    const friendId = selectedFriend?.other?.id || selectedFriend?.id;
    if (!supabase || viewMode !== 'dm' || !session?.user?.id || !friendId) return undefined;
    const directChannel = supabase.channel(`direct-messages:${session.user.id}:${friendId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const next = payload.new;
        if ((next.sender_id === session.user.id && next.recipient_id === friendId) || (next.sender_id === friendId && next.recipient_id === session.user.id)) {
          setDirectMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(directChannel); };
  }, [viewMode, selectedFriend?.other?.id, selectedFriend?.id, session?.user?.id]);

  async function createCommunityInvite() {
    if (!supabase || !communityId || !session?.user?.id) {
      setCommunityInvite('Entre em uma comunidade online antes de gerar um convite.');
      return;
    }
    const code = `AM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const { data, error } = await supabase.from('community_invites').insert({ community_id: communityId, inviter_id: session.user.id, invite_code: code }).select('invite_code').single();
    if (error) {
      setCommunityInvite(`Erro ao gerar convite: ${error.message}`);
      return;
    }
    setCommunityInvite(data.invite_code);
    setFriendStatus('Convite gerado. Copie o código e envie para seu amigo.');
  }

  async function acceptCommunityInvite() {
    const code = inviteCode.trim().toUpperCase();
    if (!supabase || !session?.user?.id || !code) return;
    const { data, error } = await supabase.rpc('redeem_community_invite', { input_code: code });
    if (error || !data?.length) {
      setFriendStatus(error?.message?.includes('expirado') ? 'Convite inválido ou expirado.' : 'Não foi possível aceitar esse convite. Confira o código e tente novamente.');
      return;
    }
    setFriendStatus('Você entrou na comunidade pelo convite.');
    setInviteCode('');
    setCommunityReload((current) => current + 1);
    setShowInvite(false);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      if (supabase) {
        if (authMode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email: authEmail.trim(),
            password: authPassword,
            options: { data: { display_name: authName.trim() || authEmail.split('@')[0] } }
          });
          if (error) throw error;
          if (!data.session) setAuthError('Cadastro realizado. Verifique seu email para confirmar a conta.');
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
          if (error) throw error;
        }
      } else {
        if (!authName.trim() || !authEmail.trim() || authPassword.length < 4) {
          throw new Error('Informe nome, email e uma senha com pelo menos 4 caracteres.');
        }
        const nextUser = { id: `local-${Date.now()}`, name: authName.trim(), email: authEmail.trim() };
        localStorage.setItem('amigos_local_user', JSON.stringify(nextUser));
        setLocalUser(nextUser);
      }
    } catch (error) {
      setAuthError(error.message || 'Não foi possível concluir o acesso.');
    } finally {
      setAuthBusy(false);
    }
  }

  function openSettings() {
    setProfileNameDraft(activeUser?.name || '');
    setProfileAvatarDraft(activeUser?.avatar_url || '');
    setShowSettings(true);
    refreshAudioDevices();
  }

  function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfileAvatarDraft(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function saveProfileSettings(event) {
    event.preventDefault();
    const name = profileNameDraft.trim() || activeUser?.name || 'Você';
    localStorage.setItem('amigos_master_volume', String(masterVolume));
    localStorage.setItem('amigos_mic_sensitivity', String(micSensitivity));
    if (supabase && session?.user?.id) {
      const { data: authData, error: authUpdateError } = await supabase.auth.updateUser({ data: { display_name: name } });
      const { error: profileError } = await supabase.from('profiles').update({ display_name: name, avatar_url: profileAvatarDraft }).eq('id', session.user.id);
      if (authUpdateError || profileError) { showNotice(`Não foi possível salvar o perfil online: ${(authUpdateError || profileError).message}`); return; }
      setProfileOverride({ name, avatar_url: profileAvatarDraft });
      if (authData?.user) setSession((current) => current ? { ...current, user: authData.user } : current);
    } else {
      const nextUser = { ...activeUser, name, avatar_url: profileAvatarDraft };
      localStorage.setItem('amigos_local_user', JSON.stringify(nextUser));
      setLocalUser(nextUser);
    }
    setShowSettings(false);
    showNotice('Perfil e preferências salvos.');
  }

  async function signOut() {
    if (supabase && session) await supabase.auth.signOut();
    localStorage.removeItem('amigos_local_user');
    setLocalUser(null);
    setSession(null);
    setVoiceJoined(false);
  }

  async function toggleVoice(targetChannelId = null) {
    const requestedChannelId = targetChannelId || allChannels.find((item) => item.type === 'voice')?.id || channel?.id;
    if (!requestedChannelId) {
      showNotice('Esta comunidade ainda não possui uma sala de voz.');
      return;
    }
    if (voiceJoined && voiceChannelId === requestedChannelId) {
      microphoneStream?.getTracks().forEach((track) => track.stop());
      setMicrophoneStream(null);
      setVoiceJoined(false);
      setVoiceChannelId(null);
      playVoiceTone('leave');
      setNotice('Você saiu da sala de voz.');
      window.setTimeout(() => setNotice(''), 2600);
      return;
    }
    if (voiceJoined && voiceChannelId !== requestedChannelId) {
      microphoneStream?.getTracks().forEach((track) => track.stop());
      setMicrophoneStream(null);
      setVoiceJoined(false);
      setVoiceChannelId(null);
    }
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: selectedInput !== 'default' ? { deviceId: { exact: selectedInput } } : true });
      setMicrophoneStream(audio);
    } catch {
      showNotice('Não foi possível acessar o microfone selecionado.');
      return;
    }
    setVoiceChannelId(requestedChannelId);
    setVoiceJoined(true);
    playVoiceTone('join');
    setNotice(`Você entrou em ${allChannels.find((item) => item.id === requestedChannelId)?.label || 'sala de voz'}.`);
    window.setTimeout(() => setNotice(''), 2600);
  }

  async function createChannel(event) {
    event.preventDefault();
    const label = newChannelName.trim().toLowerCase().replace(/\\s+/g, '-');
    if (!label) return;
    const description = newChannelType === 'voice' ? 'Sala de voz da comunidade' : 'Novo canal de conversa';
    if (remoteReady && supabase && communityId && session?.user?.id) {
      const { data, error } = await supabase.from('channels').insert({
        community_id: communityId,
        name: label,
        type: newChannelType,
        description,
        position: allChannels.length,
        created_by: session.user.id
      }).select('id,name,type,description,position').single();
      if (error) {
        showNotice('Não foi possível criar o canal online.');
        return;
      }
      const created = { id: data.id, label: data.name, type: data.type, description: data.description };
      setRemoteChannels((current) => [...current, created]);
      setSelectedChannel(created.id);
    } else {
      const id = `custom-${Date.now()}`;
      setCustomChannels((current) => [...current, { id, label, description, type: newChannelType }]);
      setSelectedChannel(id);
    }
    setNewChannelName('');
    setShowChannelCreator(false);
    showNotice(`${newChannelType === 'voice' ? 'Sala de voz' : 'Canal de texto'} criado.`);
  }

  function openCommunitySettings() {
    setCommunitySettingsName(communityName);
    setShowCommunitySettings(true);
  }

  async function saveCommunitySettings(event) {
    event.preventDefault();
    const name = communitySettingsName.trim();
    if (!name || !communityId || !supabase) return;
    const { error } = await supabase.from('communities').update({ name }).eq('id', communityId);
    if (error) { showNotice('Não foi possível salvar as configurações da comunidade.'); return; }
    setCommunityName(name);
    setShowCommunitySettings(false);
    showNotice('Configurações da comunidade salvas.');
  }

  async function createCommunityRole(event) {
    event.preventDefault();
    const name = newRoleName.trim();
    if (!name) return;
    if (supabase && communityId) {
      const { error } = await supabase.from('community_roles').insert({ community_id: communityId, name, can_manage_channels: false, can_moderate: false });
      if (error) { showNotice('Não foi possível criar o cargo online.'); return; }
    }
    setRoles((current) => [...current, name]);
    setNewRoleName('');
    showNotice(`Cargo ${name} criado.`);
  }

  async function leaveCommunity() {
    const currentCommunity = communityList.find((item) => item.id === communityId) || { id: communityId, name: communityName, owner_id: communityOwnerId };
    await leaveOrDeleteCommunity(currentCommunity, 'leave');
    setShowCommunitySettings(false);
  }

  async function createCommunity(event) {
    event.preventDefault();
    const name = newCommunityName.trim();
    if (!name) return;
    if (!supabase || !session?.user?.id) {
      showNotice('Faça login com o Supabase para criar uma comunidade.');
      return;
    }
    const { data: createdCommunity, error: communityError } = await supabase.from('communities').insert({ name, owner_id: session.user.id }).select('id,name,owner_id').single();
    if (communityError) { showNotice('Não foi possível criar a comunidade.'); return; }
    const { error: memberError } = await supabase.from('community_members').insert({ community_id: createdCommunity.id, user_id: session.user.id, role: 'Organizador' });
    if (memberError) { showNotice('A comunidade foi criada, mas não foi possível registrar o proprietário.'); return; }
    const { data: createdChannels, error: channelsError } = await supabase.from('channels').insert([
      { community_id: createdCommunity.id, name: 'geral', type: 'text', description: 'Conversa principal da comunidade', position: 0, created_by: session.user.id },
      { community_id: createdCommunity.id, name: 'conversa', type: 'voice', description: 'Sala de voz da comunidade', position: 1, created_by: session.user.id }
    ]).select('id,name,type,description,position');
    if (channelsError) { showNotice('Comunidade criada; os canais iniciais precisam ser refeitos.'); return; }
    setCommunityId(createdCommunity.id);
            setCommunityName(createdCommunity.name);
        setCommunityOwnerId(createdCommunity.owner_id);
        setCurrentRole('Organizador');
        setCommunityList((current) => [...current.filter((item) => item.id !== createdCommunity.id), { ...createdCommunity, role: 'Organizador' }]);
        localStorage.setItem(`amigos_active_community:${session.user.id}`, createdCommunity.id);

    setRemoteChannels((createdChannels || []).map((item) => ({ id: item.id, label: item.name, type: item.type, description: item.description })));
    setRemoteReady(true);
    setSelectedChannel(createdChannels?.find((item) => item.type === 'text')?.id || 'geral');
    setNewCommunityName('');
    setShowCommunityCreator(false);
    showNotice(`Comunidade ${name} criada. Você é o administrador.`);
  }

  function beginChannelEdit(item) {
    setEditingChannel(item);
    setChannelEditName(item.label);
    setChannelMenu(null);
  }

  async function saveChannelEdit(event) {
    event.preventDefault();
    const nextName = channelEditName.trim().toLowerCase().replace(/\\s+/g, '-');
    if (!editingChannel || !nextName) return;
    if (remoteReady && supabase && editingChannel.id && !editingChannel.id.startsWith('custom-')) {
      const { error } = await supabase.from('channels').update({ name: nextName }).eq('id', editingChannel.id);
      if (error) { showNotice('Não foi possível renomear o canal online.'); return; }
      setRemoteChannels((current) => current.map((item) => item.id === editingChannel.id ? { ...item, label: nextName } : item));
    } else {
      setCustomChannels((current) => current.map((item) => item.id === editingChannel.id ? { ...item, label: nextName } : item));
    }
    setEditingChannel(null);
    showNotice('Canal renomeado.');
  }

  async function moderateMember(member, action) {
    const name = member.name;
    if (action === 'volume') {
      setVolumeEditor({ member, value: volumeByUser[name] ?? 100 });
      setModerationMenu(null);
      return;
    }
    if (!isAdmin) {
      if (action === 'mute') {
        const next = !localMutedUsers[name];
        setLocalMutedUsers((current) => ({ ...current, [name]: next }));
        playVoiceTone(next ? 'mute' : 'join');
        showNotice(`${name} ${next ? 'mutado' : 'liberado'} apenas para você.`);
      }
      if (action === 'deafen') {
        const next = !localDeafenedUsers[name];
        setLocalDeafenedUsers((current) => ({ ...current, [name]: next }));
        playVoiceTone(next ? 'mute' : 'join');
        showNotice(`${name} ${next ? 'ensurdecido' : 'liberado'} apenas para você.`);
      }
      setModerationMenu(null);
      return;
    }
    if (action === 'disconnect' || action === 'kick') {
      setDisconnectedUsers((current) => ({ ...current, [name]: true }));
      setVoiceParticipants((current) => current.filter((participant) => participant.id !== member.id && participant.name !== name));
    }
    let changedState = '';
    if (action === 'server_mute') {
      const next = !serverMuted[name];
      setServerMuted((current) => ({ ...current, [name]: next }));
      changedState = next ? 'mutado para todos' : 'liberado para todos';
      playVoiceTone(next ? 'mute' : 'join');
    }
    if (action === 'server_deafen') {
      const next = !serverDeafened[name];
      setServerDeafened((current) => ({ ...current, [name]: next }));
      changedState = next ? 'ensurdecido para todos' : 'liberado para todos';
      playVoiceTone(next ? 'mute' : 'join');
    }
    if (remoteReady && supabase && communityId && member.id) {
      await supabase.from('moderation_actions').insert({ community_id: communityId, moderator_id: session.user.id, target_user_id: member.id, action, channel_id: channel?.id });
      if (action === 'kick') await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', member.id);
    }
    setModerationMenu(null);
    showNotice(action === 'kick' ? `${name} foi expulso da comunidade.` : action === 'disconnect' ? `${name} foi desconectado da sala.` : changedState ? `${name} foi ${changedState}.` : `${name} foi atualizado.`);
  }

  function saveVolume() {
    if (!volumeEditor) return;
    setVolumeByUser((current) => ({ ...current, [volumeEditor.member.name]: volumeEditor.value }));
    showNotice(`Volume de ${volumeEditor.member.name} ajustado para ${volumeEditor.value}%.`);
    setVolumeEditor(null);
  }

  async function assignRole(memberName, role) {
    setMemberRoles((current) => ({ ...current, [memberName]: role }));
    if (remoteReady && supabase && communityId) {
      const { data: profile } = await supabase.from('profiles').select('id').eq('display_name', memberName).maybeSingle();
      if (profile?.id) await supabase.from('community_members').update({ role }).eq('community_id', communityId).eq('user_id', profile.id);
    }
    setRoleMember(null);
    showNotice(`Cargo de ${memberName} atualizado para ${role}.`);
  }

  function formatAudioDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${String(remaining).padStart(2, '0')}`;
  }

  async function toggleAudioRecording() {
    if (recordingAudio) {
      audioRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showNotice('A gravação de áudio não é suportada neste ambiente.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: selectedInput !== 'default' ? { deviceId: { exact: selectedInput } } : true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingLevelsRef.current = [];
      const LevelAudioContext = window.AudioContext || window.webkitAudioContext;
      if (LevelAudioContext) {
        const levelContext = new LevelAudioContext();
        const levelAnalyser = levelContext.createAnalyser();
        levelAnalyser.fftSize = 512;
        levelAnalyser.smoothingTimeConstant = 0.7;
        const levelSource = levelContext.createMediaStreamSource(stream);
        const levelData = new Uint8Array(levelAnalyser.fftSize);
        levelSource.connect(levelAnalyser);
        let levelFrame;
        const sampleRecordingLevel = () => {
          levelAnalyser.getByteTimeDomainData(levelData);
          let sum = 0;
          for (let index = 0; index < levelData.length; index += 1) { const sample = (levelData[index] - 128) / 128; sum += sample * sample; }
          const rms = Math.sqrt(sum / levelData.length);
          recordingLevelsRef.current.push(Math.min(1, Math.max(0.08, rms * 7)));
          levelFrame = requestAnimationFrame(sampleRecordingLevel);
        };
        levelContext.resume().catch(() => {});
        sampleRecordingLevel();
        recordingAnalysisRef.current = { context: levelContext, analyser: levelAnalyser, source: levelSource, frame: () => cancelAnimationFrame(levelFrame) };
      }
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setRecordingAudio(true);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        clearInterval(recordingTimerRef.current);
        if (recordingAnalysisRef.current) {
          recordingAnalysisRef.current.frame();
          recordingAnalysisRef.current.source.disconnect();
          recordingAnalysisRef.current.analyser.disconnect();
          recordingAnalysisRef.current.context.close().catch(() => {});
          recordingAnalysisRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        setRecordingAudio(false);
        setRecordingSeconds(0);
        audioRecorderRef.current = null;
        const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000));
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const localUrl = URL.createObjectURL(blob);
        const waveform = recordingLevelsRef.current.length ? recordingLevelsRef.current.slice(0, 90) : [0.25, 0.38, 0.2, 0.55, 0.32, 0.7, 0.42, 0.26];
        const audioMessage = { id: Date.now(), type: 'audio', author: activeUser?.name || 'Você', initials: (activeUser?.name || 'VC').slice(0, 2).toUpperCase(), color: 'green', time: 'Agora', text: '[Mensagem de áudio]', audioUrl: localUrl, duration: seconds, waveform };
        if (remoteReady && supabase && session?.user?.id && channel?.type === 'text') {
          let publicUrl = localUrl;
          const filePath = `${session.user.id}/${Date.now()}.webm`;
          const { error: uploadError } = await supabase.storage.from('chat-audio').upload(filePath, blob, { contentType: blob.type, upsert: false });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('chat-audio').getPublicUrl(filePath);
            publicUrl = urlData.publicUrl;
          }
          const { data, error } = await supabase.from('messages').insert({ channel_id: channel.id, author_id: session.user.id, content: '[Mensagem de áudio]', message_type: 'audio', audio_url: publicUrl, duration_seconds: seconds, waveform }).select('id,content,created_at,message_type,audio_url,duration_seconds,waveform,profiles(display_name,avatar_color)').single();
          if (!error && data) {
            setMessages((current) => [...current, { ...audioMessage, id: data.id, audioUrl: data.audio_url || publicUrl, duration: data.duration_seconds || seconds, waveform: data.waveform || waveform, time: new Date(data.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]);
          } else {
            setMessages((current) => [...current, audioMessage]);
            showNotice('Áudio salvo localmente; execute a migração de áudio para sincronizar.');
          }
        } else {
          setMessages((current) => [...current, audioMessage]);
        }
      };
      recorder.start(250);
      recordingTimerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
        setRecordingSeconds(seconds);
        if (seconds >= 120) recorder.stop();
      }, 250);
    } catch {
      setRecordingAudio(false);
      showNotice('Não foi possível acessar o microfone para gravar.');
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    const localMessage = {
      id: Date.now(),
      author: activeUser?.name || 'Você',
      initials: (activeUser?.name || 'VC').slice(0, 2).toUpperCase(),
      color: 'green',
      time: 'Agora',
      text: value
    };
    setDraft('');

    if (remoteReady && supabase && session?.user?.id && channel?.type === 'text') {
      const { data, error } = await supabase.from('messages').insert({
        channel_id: channel.id,
        author_id: session.user.id,
        content: value
      }).select('id,content,created_at,profiles(display_name,avatar_color)').single();
      if (error) {
        setMessages((current) => [...current, localMessage]);
        showNotice('Mensagem salva localmente; verifique as políticas do Supabase.');
      } else if (data) {
        setMessages((current) => [...current, {
          ...localMessage,
          id: data.id,
          time: new Date(data.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } else {
      setMessages((current) => [...current, localMessage]);
    }
  }

  async function openSharePicker() {
    try {
      const sources = window.desktopApi?.getSources ? await window.desktopApi.getSources() : [];
      setShareSources(sources);
    } catch {
      setShareSources([]);
    }
    setShowSharePicker(true);
  }

  function stopSharing() {
    screenStream?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    setSharing(false);
    setNotice('Transmissão encerrada.');
  }

  async function startSharing() {
    const qualityMap = {
      '1080p': { width: 1920, height: 1080, frameRate: 30 },
      '720p': { width: 1280, height: 720, frameRate: 30 },
      '480p': { width: 854, height: 480, frameRate: 24 }
    };
    try {
      if (shareSourceId && window.desktopApi?.selectSource) await window.desktopApi.selectSource(shareSourceId);
      const quality = qualityMap[shareQuality];
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: quality.width }, height: { ideal: quality.height }, frameRate: { ideal: quality.frameRate } },
        audio: true
      });
      stream.getVideoTracks()[0]?.addEventListener('ended', stopSharing);
      setScreenStream(stream);
      setSharing(true);
      setShowSharePicker(false);
      setNotice(`Transmitindo ${shareQuality} nesta sala.`);
    } catch {
      setNotice('A transmissão foi cancelada.');
    }
  }

  function toggleShare() {
    if (sharing) stopSharing();
    else openSharePicker();
  }

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  function updatePresence(nextPresence) {
    setPresenceStatus(nextPresence);
    localStorage.setItem('amigos_presence_status', nextPresence);
    setShowPresenceMenu(false);
    showNotice(`Status alterado para ${presenceLabel(nextPresence)}.`);
  }

  if (!activeUser) {
    return <AuthScreen
      mode={authMode}
      setMode={(mode) => { setAuthMode(mode); setAuthError(''); }}
      email={authEmail}
      setEmail={setAuthEmail}
      name={authName}
      setName={setAuthName}
      password={authPassword}
      setPassword={setAuthPassword}
      configured={isSupabaseConfigured}
      busy={authBusy}
      error={authError}
      onSubmit={submitAuth}
    />;
  }

  if (viewMode === 'lobby') {
    return <LobbyScreen activeUser={activeUser} friends={friendsList} requests={friendRequests} communityInvites={communityFriendInvites} socialStatus={friendStatus} communityInviteStatus={communityFriendInviteStatus} search={friendSearch} setSearch={setFriendSearch} onSearch={sendFriendRequest} onRespond={respondToFriendRequest} onRespondCommunityInvite={respondToCommunityFriendInvite} onOpenFriend={openDirectChat} communities={communityRailItems} currentCommunityId={communityId} onCommunity={(item) => { setViewMode('community'); switchCommunity(item); }} onCreateCommunity={() => setShowCommunityCreator(true)} />;
  }

  if (viewMode === 'dm') {
    return <DirectChatScreen activeUser={activeUser} friend={selectedFriend} messages={directMessages} draft={draft} setDraft={setDraft} onSubmit={sendDirectMessage} onBack={openLobby} communities={communityRailItems} currentCommunityId={communityId} onCommunity={(item) => { setViewMode('community'); switchCommunity(item); }} onCreateCommunity={() => setShowCommunityCreator(true)} />;
  }

  return (
    <div className="app-shell">
      <aside className="server-rail">
        <button className="brand-mark" title="Lobby de amizades" onClick={openLobby}>
          <span>A</span>
        </button>
        <div className="rail-divider" />
        <div className="community-rail-list">{communityRailItems.map((community) => <button key={community.id} className={`server-icon ${community.id === communityId ? 'active' : ''} ${mutedCommunities[community.id] ? 'community-muted' : ''}`} onClick={() => switchCommunity(community)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setCommunityMenu({ x: event.clientX, y: event.clientY, community }); }} title={`${community.name}${community.id === communityId ? ' · atual' : ''}${mutedCommunities[community.id] ? ' · silenciada' : ''}`}><span>{mutedCommunities[community.id] ? <VolumeX size={18} /> : community.name.slice(0, 2).toUpperCase()}</span></button>)}</div>
        <button className="server-icon add-server" onClick={() => setShowCommunityCreator(true)} title="Criar nova comunidade"><Plus size={21} /></button>
        <button className="server-icon help-server" onClick={() => showNotice('O suporte da comunidade ficará disponível em breve.')} title="Ajuda"><HelpCircle size={19} /></button>
        <div className="rail-bottom">
          <button className="icon-button rail-settings" onClick={() => openSettings()} title="Configurações"><Settings size={18} /></button>
        </div>
      </aside>

      <aside className="channel-sidebar">
        <button className="community-header" onClick={openCommunitySettings}>
          <span>{communityName}</span><ChevronDown size={18} />
        </button>
        <div className="community-scroll">
          <div className="sidebar-section-title"><span>CANAIS DE TEXTO</span><button onClick={() => { setNewChannelType('text'); setShowChannelCreator(true); }} title="Criar canal de texto"><Plus size={16} /></button></div>
          {allChannels.filter((item) => item.type !== 'voice').map((item) => (
            <button
              key={item.id}
              className={`channel-row ${selectedChannel === item.id ? 'selected' : ''}`}
              onClick={() => setSelectedChannel(item.id)}
              onContextMenu={(event) => { event.preventDefault(); setChannelMenu({ x: event.clientX, y: event.clientY, item }); }}
              title={item.description}
            >
              <Hash size={19} /><span>{item.label}</span>{selectedChannel === item.id && <span className="unread-pill">3</span>}
            </button>
          ))}
          <div className="sidebar-section-title voice-title"><span>CANAIS DE VOZ</span><button onClick={() => { setNewChannelType('voice'); setShowChannelCreator(true); }} title="Criar sala de voz"><Plus size={16} /></button></div>
          {allChannels.filter((item) => item.type === 'voice').map((item) => <button key={item.id} className={`channel-row voice-channel ${voiceJoined && voiceChannelId === item.id ? 'voice-connected' : ''}`} onClick={() => toggleVoice(item.id)} onContextMenu={(event) => { event.preventDefault(); setChannelMenu({ x: event.clientX, y: event.clientY, item }); }} title={item.description}><Volume2 size={19} /><span>{item.label}</span>{voiceJoined && voiceChannelId === item.id && <span className="voice-state">conectado</span>}</button>)}
          <div className={`voice-preview ${voiceJoined ? 'voice-preview-connected' : ''}`}>
            <div className="voice-preview-title"><span className="pulse-dot" /> {voiceJoined ? 'Voz conectada' : 'Voz disponível'}</div>
            <p>{voiceJoined ? 'Você está visível para a comunidade nesta sala.' : 'Entre para conversar com os seus amigos.'}</p>
            {voiceJoined && (voiceParticipants.length ? voiceParticipants : [{ id: activeUser?.id, name: activeUser?.name || 'Você', initials: (activeUser?.name || 'VC').slice(0, 2).toUpperCase(), color: 'green', avatar_url: activeUser?.avatar_url || '', speaking: voiceSpeaking }]).map((participant) => {
              const participantName = participant.name || 'Membro';
              const isSelf = participant.id === activeUser?.id || participantName === activeUser?.name || participantName === 'Você';
              const isMuted = localMutedUsers[participantName] || serverMuted[participantName];
              const isDeafened = localDeafenedUsers[participantName] || serverDeafened[participantName];
              const isSpeaking = Boolean(participant.speaking || (isSelf && voiceSpeaking));
              return <div className={`voice-participant ${isSelf ? 'voice-participant-self' : ''} ${isSpeaking ? 'voice-participant-speaking' : ''}`} key={participant.id || participantName} title="Botão direito para opções de voz" onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setModerationMenu({ x: event.clientX, y: event.clientY, member: { id: participant.id, name: participantName, initials: participant.initials || 'MB', color: participant.color || 'blue', online: true } }); }}><Avatar initials={participant.initials || 'MB'} color={participant.color || 'blue'} online small image={isSelf ? activeUser?.avatar_url : participant.avatar_url} speaking={isSpeaking} /><span className="voice-participant-copy"><strong>{participantName} {isSelf && <em className="you-badge">você</em>}</strong><small>{isDeafened ? 'ensurdecido' : isMuted ? 'mutado' : 'conectado agora'}</small></span><span className="voice-indicators">{isMuted && <span className="voice-badge muted" title="Microfone mutado"><MicOff size={12} /></span>}{isDeafened && <span className="voice-badge deafened" title="Áudio ensurdecido"><Headphones size={12} /></span>}</span></div>;
            })}
            <button onClick={() => toggleVoice(voiceChannelId || allChannels.find((item) => item.type === 'voice')?.id)}><PhoneCall size={15} /> {voiceJoined ? 'Sair da sala' : 'Entrar agora'}</button>
          </div>
        </div>
        <div className="voice-controls">
          <div className="voice-control-status"><span className={voiceJoined ? 'pulse-dot' : 'muted-dot'} /> <div><strong>{voiceJoined ? 'conversa' : 'Voz desligada'}</strong><small>{voiceJoined ? 'conectado' : 'entre em uma sala'}</small></div></div>
          <div className="voice-control-actions"><button onClick={() => { if (!voiceJoined) toggleVoice(voiceChannelId); setMuted(!muted); }} className={muted ? 'dock-active' : ''} title={muted ? 'Ativar microfone' : 'Silenciar microfone'}>{muted ? <MicOff size={17} /> : <Mic size={17} />}</button><button onClick={toggleShare} className={sharing ? 'dock-active share-active' : ''} title={sharing ? 'Parar compartilhamento' : 'Compartilhar tela'}><MonitorUp size={17} /></button><button onClick={() => showNotice('Câmera disponível em breve.')} title="Ativar câmera"><Video size={17} /></button><button className="end-call" onClick={() => { if (voiceJoined) toggleVoice(voiceChannelId); else showNotice('Você não está em uma sala de voz.'); }} title="Desconectar"><PhoneCall size={17} /></button></div>
        </div>
        <div className="profile-bar">
          <button className="profile-summary" onClick={() => setShowProfile(true)}>
            <Avatar initials={(activeUser?.name || 'VC').slice(0, 2).toUpperCase()} color={presenceColor} online={presenceStatus !== 'offline'} presence={presenceStatus} small image={activeUser?.avatar_url} />
            <span className={`profile-text profile-${presenceStatus}`}><strong>{activeUser?.name || 'Você'}</strong><small>{presenceLabel(presenceStatus)}</small></span>
          </button>
          <div className="presence-control"><button className="presence-trigger" onClick={() => setShowPresenceMenu((current) => !current)} title="Alterar status"><span className={`presence-dot presence-${presenceStatus}`} />{presenceLabel(presenceStatus)}<ChevronDown size={12} /></button>{showPresenceMenu && <div className="presence-menu">{presenceOptions.map((option) => <button key={option.id} onClick={() => updatePresence(option.id)}><span className={`presence-dot presence-${option.id}`} /><span><strong>{option.label}</strong><small>{option.description}</small></span></button>)}</div>}</div>
          <div className="profile-actions">
            <button className={`icon-button ${muted ? 'active-danger' : ''}`} onClick={() => setMuted(!muted)} title={muted ? 'Ativar microfone' : 'Silenciar microfone'}>{muted ? <MicOff size={16} /> : <Mic size={16} />}</button>
            <button className={`icon-button ${deafened ? 'active-danger' : ''}`} onClick={() => setDeafened(!deafened)} title="Desativar áudio"><Headphones size={16} /></button>
            <button className="icon-button" onClick={() => openSettings()} title="Configurações"><Settings size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="channel-heading"><Hash size={21} /><strong>{channel.label}</strong><span className="heading-divider" /> <span className="channel-description">{channel.description}</span></div>
          <div className="topbar-actions">
            <button className="topbar-icon" onClick={() => showNotice('Notificações em dia.')} title="Notificações"><Bell size={19} /></button>
            <button className="topbar-icon" onClick={() => showNotice('Busca pronta para o servidor.')} title="Buscar"><Search size={20} /></button>
            <button className="topbar-icon" onClick={() => setShowFriends(true)} title="Amigos e solicitações"><Users size={20} /></button>
            <button className="topbar-icon" onClick={() => setShowInvite(true)} title="Convidar para a comunidade"><Plus size={20} /></button>
            <button className="topbar-icon" onClick={() => showNotice('Mais opções em breve.')} title="Mais opções"><MoreHorizontal size={21} /></button>
          </div>
        </header>

        <section className="chat-layout">
          <div className="chat-content">
            <div className="welcome-card">
              <div className="welcome-icon"><Hash size={27} /></div>
              <h1>Bem-vindo ao #{channel.label}!</h1>
              <p>Este é o começo deste canal. Compartilhe uma mensagem com a sua comunidade.</p>
            </div>
            <div className="message-list">
              {messages.map((message) => (
                <article className="message" key={message.id}>
                  <Avatar initials={message.initials} color={message.color} />
                  <div className="message-body">
                    <div className="message-meta"><strong>{message.author}</strong><time>{message.time}</time></div>
                    {message.type === 'audio' && message.audioUrl ? <AudioMessage src={message.audioUrl} duration={message.duration || 0} waveform={message.waveform || []} masterVolume={masterVolume} outputDevice={selectedOutput} /> : <p>{message.text}</p>}
                  </div>
                </article>
              ))}
            </div>
            {showEmojiPicker && <EmojiPicker onSelect={(emoji) => { setDraft((current) => `${current}${emoji}`); setShowEmojiPicker(false); }} onClose={() => setShowEmojiPicker(false)} />}
            <form className={`composer ${recordingAudio ? 'composer-recording' : ''}`} onSubmit={submitMessage}>
              <button type="button" className="composer-action" onClick={() => showNotice('Em breve: anexar arquivo.')} title="Anexar arquivo"><Paperclip size={20} /></button>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={recordingAudio ? `Gravando áudio · ${formatAudioTime(recordingSeconds)}` : `Enviar mensagem em #${channel.label}`} aria-label="Mensagem" disabled={recordingAudio} />
              <div className="composer-actions"><button type="button" onClick={() => setShowEmojiPicker((current) => !current)} className={showEmojiPicker ? 'emoji-active' : ''} title="Escolher emoji"><Smile size={19} /></button><button type="button" onClick={toggleAudioRecording} className={`audio-record-button ${recordingAudio ? 'recording' : ''}`} title={recordingAudio ? 'Parar gravação' : 'Gravar mensagem de áudio'}>{recordingAudio ? <span className="recording-stop" /> : <Mic size={18} />}</button><button className="send-button" type="submit" title="Enviar" disabled={recordingAudio}><Send size={18} /></button></div>
            </form>
          </div>
          <aside className="member-sidebar">
            <div className="member-group"><h3><span className="presence-heading"><i className="presence-dot presence-online" /> ONLINE — {displayMembers.filter((member) => (member.presence === 'online' || (!member.presence && member.online)) && !disconnectedUsers[member.name]).length}</span></h3>{displayMembers.filter((member) => (member.presence === 'online' || (!member.presence && member.online)) && !disconnectedUsers[member.name]).map((member) => <Member key={member.name} {...member} online presence={member.presence || 'online'} role={memberRoles[member.name]} isSelf={member.name === 'Você' || member.name === activeUser?.name} onManageRole={() => { setRoleMember(member.name); setShowRoles(true); }} onContextMenu={(event) => { event.preventDefault(); setModerationMenu({ x: event.clientX, y: event.clientY, member }); }} />)}</div>
            <div className="member-group"><h3><span className="presence-heading"><i className="presence-dot presence-idle" /> AUSENTE — {displayMembers.filter((member) => member.presence === 'idle' && !disconnectedUsers[member.name]).length}</span></h3>{displayMembers.filter((member) => member.presence === 'idle' && !disconnectedUsers[member.name]).map((member) => <Member key={member.name} {...member} online presence="idle" role={memberRoles[member.name]} isSelf={member.name === 'Você' || member.name === activeUser?.name} onManageRole={() => { setRoleMember(member.name); setShowRoles(true); }} onContextMenu={(event) => { event.preventDefault(); setModerationMenu({ x: event.clientX, y: event.clientY, member }); }} />)}</div>
            <div className="member-group"><h3><span className="presence-heading"><i className="presence-dot presence-offline" /> OFFLINE — {displayMembers.filter((member) => (member.presence === 'offline' || (!member.presence && !member.online)) && !disconnectedUsers[member.name]).length}</span></h3>{displayMembers.filter((member) => (member.presence === 'offline' || (!member.presence && !member.online)) && !disconnectedUsers[member.name]).map((member) => <Member key={member.name} {...member} online={false} presence="offline" role={memberRoles[member.name]} isSelf={member.name === 'Você' || member.name === activeUser?.name} onManageRole={() => { setRoleMember(member.name); setShowRoles(true); }} onContextMenu={(event) => { event.preventDefault(); setModerationMenu({ x: event.clientX, y: event.clientY, member }); }} />)}</div>
          </aside>
        </section>

      </main>

      {notice && <div className="toast">{notice}</div>}
      {showProfile && <Modal title="Seu perfil" onClose={() => setShowProfile(false)}><div className="profile-modal"><Avatar initials={(activeUser?.name || 'VC').slice(0, 2).toUpperCase()} color="green" online image={activeUser?.avatar_url} /><h2>{activeUser.name}</h2><p>{activeUser.email || 'Conta local de demonstração'}</p><button className="primary-button" onClick={() => setShowProfile(false)}>Fechar</button><button className="secondary-button" onClick={signOut}><LogOut size={15} /> Sair da conta</button></div></Modal>}
      {showSettings && <Modal title="Configurações do usuário" wide onClose={() => setShowSettings(false)}><UserSettings activeUser={activeUser} name={profileNameDraft} setName={setProfileNameDraft} avatar={profileAvatarDraft} onAvatar={handleAvatarFile} inputs={audioInputs} outputs={audioOutputs} selectedInput={selectedInput} selectedOutput={selectedOutput} masterVolume={masterVolume} setMasterVolume={setMasterVolume} micSensitivity={micSensitivity} setMicSensitivity={setMicSensitivity} onInput={chooseAudioInput} onOutput={chooseAudioOutput} onRefresh={refreshAudioDevices} onSave={saveProfileSettings} /></Modal>}
      {showChannelCreator && <Modal title="Criar canal" onClose={() => setShowChannelCreator(false)}><form className="creator-form" onSubmit={createChannel}><label>Nome do canal<input autoFocus value={newChannelName} onChange={(event) => setNewChannelName(event.target.value)} placeholder="ex.: ideias" /></label><label>Tipo<select value={newChannelType} onChange={(event) => setNewChannelType(event.target.value)}><option value="text">Canal de texto</option><option value="voice">Canal de voz</option></select></label><button className="primary-button" type="submit"><Plus size={16} /> Criar canal</button></form></Modal>}
      {showRoles && <Modal title={`Cargo de ${roleMember}`} onClose={() => setShowRoles(false)}><div className="role-picker"><p>Escolha o cargo deste membro:</p>{roles.map((role) => <button key={role} className={`role-option ${memberRoles[roleMember] === role ? 'active' : ''}`} onClick={() => assignRole(roleMember, role)}><span className={`role-dot role-${role.toLowerCase()}`} />{role}</button>)}<button className="role-add" onClick={() => { const next = `Cargo ${roles.length + 1}`; setRoles((current) => [...current, next]); showNotice(`${next} criado.`); }}><Plus size={15} /> Criar novo cargo</button></div></Modal>}
      {showFriends && <FriendsModal search={friendSearch} setSearch={setFriendSearch} requests={friendRequests} friends={friendsList} status={friendStatus} onSearch={sendFriendRequest} onRespond={respondToFriendRequest} onClose={() => setShowFriends(false)} />}
      {showInvite && <InviteModal inviteCode={inviteCode} setInviteCode={setInviteCode} communityInvite={communityInvite} setCommunityInvite={setCommunityInvite} status={friendStatus} friends={friendsList} directStatus={communityFriendInviteStatus} onInviteFriend={sendCommunityFriendInvite} onCreate={createCommunityInvite} onAccept={acceptCommunityInvite} onClose={() => setShowInvite(false)} />}
      {showCommunityCreator && <Modal title="Criar comunidade" onClose={() => setShowCommunityCreator(false)}><form className="creator-form" onSubmit={createCommunity}><p className="modal-note">A pessoa que criar a comunidade será o proprietário e administrador principal.</p><label>Nome da comunidade<input autoFocus value={newCommunityName} onChange={(event) => setNewCommunityName(event.target.value)} placeholder="ex.: Galera dos amigos" required /></label><button className="primary-button" type="submit"><Plus size={16} /> Criar comunidade</button></form></Modal>}
      {showCommunitySettings && <Modal title="Configurações da comunidade" wide onClose={() => setShowCommunitySettings(false)}><CommunitySettings name={communitySettingsName} setName={setCommunitySettingsName} roles={roles} newRoleName={newRoleName} setNewRoleName={setNewRoleName} canManage={isAdmin} owner={communityOwnerId === activeUser?.id} onSave={saveCommunitySettings} onCreateRole={createCommunityRole} onLeave={leaveCommunity} /></Modal>}
      {showSharePicker && <SharePicker sources={shareSources} sourceId={shareSourceId} setSourceId={setShareSourceId} quality={shareQuality} setQuality={setShareQuality} onStart={startSharing} onClose={() => setShowSharePicker(false)} />}
      {sharing && <div className="screen-preview-floating"><div className="screen-preview-header"><span><span className="pulse-dot" /> Sua transmissão</span><button onClick={stopSharing}><X size={16} /></button></div><video ref={screenPreviewRef} muted playsInline /><div className="screen-preview-footer"><span>{shareQuality} · prévia local</span><button onClick={stopSharing}>Parar transmissão</button></div></div>}
      {channelMenu && isAdmin && <ContextMenu x={channelMenu.x} y={channelMenu.y} items={[{ label: 'Editar canal', onClick: () => beginChannelEdit(channelMenu.item) }]} onClose={() => setChannelMenu(null)} />}
      {communityMenu && <CommunityContextMenu x={communityMenu.x} y={communityMenu.y} community={communityMenu.community} muted={Boolean(mutedCommunities[communityMenu.community.id])} owner={communityMenu.community.owner_id === activeUser?.id} onToggleMute={toggleCommunityMuted} onLeave={(community) => leaveOrDeleteCommunity(community, 'leave')} onDelete={(community) => leaveOrDeleteCommunity(community, 'delete')} onClose={() => setCommunityMenu(null)} />}
      {moderationMenu && <ModerationMenu x={moderationMenu.x} y={moderationMenu.y} member={moderationMenu.member} admin={isAdmin} canKick={canKick} self={selectedVoiceUserIsSelf} onAction={moderateMember} onClose={() => setModerationMenu(null)} />}
      {editingChannel && <Modal title="Editar canal" onClose={() => setEditingChannel(null)}><form className="creator-form" onSubmit={saveChannelEdit}><label>Novo nome<input autoFocus value={channelEditName} onChange={(event) => setChannelEditName(event.target.value)} /></label><button className="primary-button" type="submit">Salvar alterações</button></form></Modal>}
      {volumeEditor && <VolumeModal member={volumeEditor.member} value={volumeEditor.value} setValue={(value) => setVolumeEditor((current) => ({ ...current, value }))} onSave={saveVolume} onClose={() => setVolumeEditor(null)} />}
    </div>
  );
}

function CommunitySettings({ name, setName, roles, newRoleName, setNewRoleName, canManage, owner, onSave, onCreateRole, onLeave }) {
  return <div className="community-settings"><form className="creator-form" onSubmit={onSave}><label>Nome da comunidade<input value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage} /></label>{canManage && <button className="primary-button" type="submit">Salvar nome</button>}</form><div className="settings-divider" /><div className="community-settings-section"><div><strong>Cargos da comunidade</strong><small>Crie cargos para organizar funções e permissões.</small></div>{roles.map((role) => <div className="community-role-row" key={role}><span className="role-dot role-membro" /><strong>{role}</strong><small>{role === 'Organizador' ? 'Administrador principal' : 'Cargo da comunidade'}</small></div>)}{canManage && <form className="role-create-row" onSubmit={onCreateRole}><input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Nome do novo cargo" /><button className="secondary-button" type="submit"><Plus size={14} /> Criar cargo</button></form>}</div><div className="settings-divider" /><div className="community-settings-section"><div><strong>Zona da comunidade</strong><small>{owner ? 'Você é o proprietário e administrador principal.' : 'Você é membro desta comunidade.'}</small></div><button className="danger-button" onClick={onLeave} disabled={owner}>{owner ? 'Proprietário não pode sair' : 'Sair da comunidade'}</button></div></div>;
}

function UserSettings({ activeUser, name, setName, avatar, onAvatar, inputs, outputs, selectedInput, selectedOutput, masterVolume, setMasterVolume, micSensitivity, setMicSensitivity, onInput, onOutput, onRefresh, onSave }) {
  return <form className="user-settings-form" onSubmit={onSave}><div className="profile-settings-head"><label className="avatar-upload"><Avatar initials={(name || activeUser?.name || 'VC').slice(0, 2).toUpperCase()} color="green" online image={avatar} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatar} /><span>Trocar foto</span></label><div><strong>{activeUser?.email || 'Conta local'}</strong><small>As alterações de perfil ficam sincronizadas.</small></div></div><label className="settings-field">Nome de exibição<input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Seu nome" /></label><div className="settings-divider" /><div className="settings-section-heading"><div><strong>Áudio</strong><small>Escolha os dispositivos e ajuste como você ouve e transmite.</small></div><button type="button" onClick={onRefresh}>Atualizar lista</button></div><label className="settings-field">Entrada de áudio<select value={selectedInput} onChange={(event) => onInput(event.target.value)}><option value="default">Microfone padrão do Windows</option>{inputs.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Microfone ${index + 1}`}</option>)}</select></label><label className="settings-field">Saída de áudio<select value={selectedOutput} onChange={(event) => onOutput(event.target.value)}><option value="default">Saída padrão do Windows</option>{outputs.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `Alto-falante ${index + 1}`}</option>)}</select></label><div className="audio-slider-field"><div><strong>Volume geral</strong><span>{masterVolume}%</span></div><input type="range" min="0" max="100" value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} /><small>Controla o volume de reprodução dos áudios do chat.</small></div><div className="audio-slider-field"><div><strong>Sensibilidade do microfone</strong><span>{micSensitivity}%</span></div><input type="range" min="0" max="100" value={micSensitivity} onChange={(event) => setMicSensitivity(Number(event.target.value))} /><small>Maior sensibilidade detecta falas mais baixas; menor reduz ruídos.</small></div><div className="theme-locked"><span>☾</span><div><strong>Tema escuro</strong><small>O tema escuro é o padrão da comunidade.</small></div><em>fixo</em></div><button className="primary-button" type="submit">Salvar configurações</button></form>;
}

function VolumeModal({ member, value, setValue, onSave, onClose }) {
  return <Modal title={`Volume de ${member.name}`} onClose={onClose}><div className="volume-modal"><div className="volume-value"><strong>{value}%</strong><span>Somente para você</span></div><input className="volume-slider" type="range" min="0" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} /><div className="volume-range"><span>0%</span><span>100%</span></div><button className="primary-button" onClick={onSave}>Salvar volume</button></div></Modal>;
}

function AudioMessage({ src, duration, waveform = [], masterVolume = 100, outputDevice = 'default' }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(100, masterVolume)) / 100;
      if (audioRef.current.setSinkId && outputDevice && outputDevice !== 'default') audioRef.current.setSinkId(outputDevice).catch(() => {});
    }
  }, [masterVolume, outputDevice]);
  const bars = waveform.length ? waveform : Array.from({ length: 42 }, (_, index) => 0.28 + ((index * 17) % 55) / 100);
  return <div className="audio-message"><div className="audio-player-row"><button type="button" className="audio-play-hint" onClick={() => { if (audioRef.current) audioRef.current.paused ? audioRef.current.play().catch(() => {}) : audioRef.current.pause(); }}><Mic size={14} /></button><div className="audio-waveform" aria-label="Forma de onda do áudio">{bars.slice(0, 54).map((level, index) => <span key={index} style={{ height: `${Math.max(16, Math.min(100, Number(level) * 100))}%` }} />)}</div><span className="audio-duration">{duration ? formatAudioTime(duration) : 'áudio'}</span></div><audio ref={audioRef} controls preload="metadata" src={src} /><span className="audio-caption"><Mic size={13} /> mensagem de áudio</span></div>;
}

function formatAudioTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function EmojiPicker({ onSelect, onClose }) {
  return <div className="emoji-picker" onMouseDown={(event) => event.stopPropagation()}><div className="emoji-picker-header"><strong>Emojis</strong><button type="button" onClick={onClose}><X size={14} /></button></div><div className="emoji-grid">{emojiOptions.map((emoji) => <button type="button" key={emoji} onClick={() => onSelect(emoji)}>{emoji}</button>)}</div></div>;
}

function CommunityContextMenu({ x, y, community, muted, owner, onToggleMute, onLeave, onDelete, onClose }) {
  const items = [
    { label: muted ? 'Ativar notificações' : 'Silenciar comunidade', onClick: () => onToggleMute(community) },
    { label: 'Sair da comunidade', onClick: () => onLeave(community) },
    ...(owner ? [{ label: 'Excluir comunidade permanentemente', danger: true, onClick: () => onDelete(community) }] : [])
  ];
  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}

function ContextMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [onClose]);
  return <div className="context-menu" style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 220) }} onClick={(event) => event.stopPropagation()}>{items.map((item) => <button key={item.label} className={item.danger ? 'danger-item' : ''} onClick={item.onClick}>{item.label}</button>)}</div>;
}

function ModerationMenu({ x, y, member, admin, canKick, self, onAction, onClose }) {
  const items = self ? [{ label: 'Este é o seu perfil · você', onClick: onClose }] : [
    ...(canKick ? [{ label: 'Expulsar da comunidade', onClick: () => onAction(member, 'kick') }] : []),
    ...(admin ? [
      { label: 'Desconectar da sala', onClick: () => onAction(member, 'disconnect') },
      { label: 'Silenciar / liberar para todos', onClick: () => onAction(member, 'server_mute') },
      { label: 'Silenciar geral / liberar para todos', onClick: () => onAction(member, 'server_deafen') }
    ] : []),
    { label: 'Controlar volume para mim', onClick: () => onAction(member, 'volume') },
    ...(!admin ? [
      { label: 'Silenciar apenas para mim', onClick: () => onAction(member, 'mute') },
      { label: 'Silenciar geral apenas para mim', onClick: () => onAction(member, 'deafen') }
    ] : [])
  ];
  return <ContextMenu x={x} y={y} items={items} onClose={onClose} />;
}

function LobbyScreen({ activeUser, friends, requests, communityInvites, socialStatus, communityInviteStatus, search, setSearch, onSearch, onRespond, onRespondCommunityInvite, onOpenFriend, communities, currentCommunityId, onCommunity, onCreateCommunity }) {
  return <div className="app-shell">
    <aside className="server-rail">
      <button className="brand-mark" title="Lobby de amizades"><span>A</span></button>
      <div className="rail-divider" />
      <div className="community-rail-list"><button className="server-icon active" title="Lobby de amizades"><Users size={18} /></button>{communities.map((community) => <button key={community.id} className={`server-icon ${community.id === currentCommunityId ? 'active' : ''}`} onClick={() => onCommunity(community)} title={community.name}><span>{community.name.slice(0, 2).toUpperCase()}</span></button>)}</div>
      <button className="server-icon add-server" onClick={onCreateCommunity} title="Criar nova comunidade"><Plus size={21} /></button>
    </aside>
    <aside className="channel-sidebar">
      <div className="community-header"><span>Lobby de amizades</span><Users size={18} /></div>
      <div className="community-scroll">
        <div className="sidebar-section-title"><span>AMIGOS</span><span>{friends.length}</span></div>
        {friends.length ? friends.map((friend) => { const profile = friend.other || {}; return <button key={friend.id} className="channel-row" onClick={() => onOpenFriend(friend)}><Avatar initials={(profile.display_name || 'AM').slice(0, 2).toUpperCase()} color={profile.avatar_color || 'blue'} online small image={profile.avatar_url} /><span>{profile.display_name || 'Amigo'}</span><MessageCircle size={15} /></button>; }) : <p className="social-empty">Adicione amigos para iniciar conversas privadas.</p>}
        <div className="sidebar-section-title voice-title"><span>SOLICITAÇÕES</span><span>{requests.length}</span></div>
        {requests.map((request) => <div className="social-row" key={request.id}><span className="social-avatar">{(request.other?.display_name || 'AM').slice(0, 2).toUpperCase()}</span><div><strong>{request.other?.display_name || 'Amigo'}</strong><small>Solicitação pendente</small></div><button onClick={() => onRespond(request, 'accepted')}>Aceitar</button></div>)}
        <div className="sidebar-section-title voice-title"><span>CONVITES DE COMUNIDADE</span><span>{communityInvites.length}</span></div>
        {communityInvites.length ? communityInvites.map((invite) => <div className="social-row" key={invite.id}><span className="social-avatar">{(invite.community?.name || 'CO').slice(0, 2).toUpperCase()}</span><div><strong>{invite.community?.name || 'Comunidade'}</strong><small>de {invite.inviter?.display_name || 'Amigo'}</small></div><button onClick={() => onRespondCommunityInvite(invite, 'accepted')}>Aceitar</button></div>) : <p className="social-empty">Nenhum convite direto pendente.</p>}
      </div>
      <div className="profile-bar"><div className="profile-summary"><Avatar initials={(activeUser?.name || 'VC').slice(0, 2).toUpperCase()} color="green" online small image={activeUser?.avatar_url} /><span className="profile-text"><strong>{activeUser?.name || 'Você'}</strong><small>Lobby de amizades</small></span></div></div>
    </aside>
    <main className="main-panel"><header className="topbar"><div className="channel-heading"><Users size={21} /><strong>Lobby de amizades</strong><span className="heading-divider" /><span className="channel-description">Converse com seus amigos fora das comunidades.</span></div><div className="topbar-actions"><button className="topbar-icon" onClick={() => document.querySelector('.lobby-search')?.focus()} title="Adicionar amigo"><Plus size={20} /></button></div></header><section className="chat-layout"><div className="chat-content"><div className="welcome-card"><div className="welcome-icon"><Users size={27} /></div><h1>Seu lobby de amizades</h1><p>Este espaço é independente das comunidades. Escolha um amigo ao lado para abrir uma conversa privada.</p><div className="social-add lobby-add"><label>Adicionar por nome de exibição<input className="lobby-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome exato do amigo" /></label><button className="primary-button" onClick={onSearch}><Plus size={15} /> Adicionar</button></div>{socialStatus && <p className="social-status">{socialStatus}</p>}</div>{requests.length > 0 && <div className="social-section lobby-requests"><h3>Solicitações recebidas <span>{requests.length}</span></h3>{requests.map((request) => <div className="social-row" key={request.id}><span className="social-avatar">{(request.other?.display_name || 'AM').slice(0, 2).toUpperCase()}</span><div><strong>{request.other?.display_name || 'Amigo'}</strong><small>Quer ser seu amigo</small></div><button onClick={() => onRespond(request, 'accepted')}>Aceitar</button><button className="social-reject" onClick={() => onRespond(request, 'declined')}>Recusar</button></div>)}</div>}{communityInvites.length > 0 && <div className="social-section lobby-requests"><h3>Convites para comunidades <span>{communityInvites.length}</span></h3>{communityInvites.map((invite) => <div className="social-row" key={invite.id}><span className="social-avatar">{(invite.community?.name || 'CO').slice(0, 2).toUpperCase()}</span><div><strong>{invite.community?.name || 'Comunidade'}</strong><small>{invite.inviter?.display_name || 'Amigo'} convidou você</small></div><button onClick={() => onRespondCommunityInvite(invite, 'accepted')}>Aceitar</button><button className="social-reject" onClick={() => onRespondCommunityInvite(invite, 'declined')}>Recusar</button></div>)}</div>}{communityInviteStatus && <p className="social-status">{communityInviteStatus}</p>}</div><aside className="member-sidebar"><div className="member-group"><h3>SEUS AMIGOS — {friends.length}</h3>{friends.map((friend) => { const profile = friend.other || {}; return <button className="member-row" key={friend.id} onClick={() => onOpenFriend(friend)}><Avatar initials={(profile.display_name || 'AM').slice(0, 2).toUpperCase()} color={profile.avatar_color || 'blue'} online small image={profile.avatar_url} /><span><strong>{profile.display_name || 'Amigo'}</strong><small>Mensagem privada</small></span><MessageCircle size={15} /></button>; })}</div></aside></section></main>
  </div>;
}

function DirectChatScreen({ activeUser, friend, messages, draft, setDraft, onSubmit, onBack, communities, currentCommunityId, onCommunity, onCreateCommunity }) {
  const profile = friend?.other || friend || {};
  const friendName = profile.display_name || 'Amigo';
  return <div className="app-shell">
    <aside className="server-rail"><button className="brand-mark" title="Voltar ao lobby" onClick={onBack}><span>A</span></button><div className="rail-divider" /><div className="community-rail-list"><button className="server-icon active" onClick={onBack} title="Lobby de amizades"><Users size={18} /></button>{communities.map((community) => <button key={community.id} className={`server-icon ${community.id === currentCommunityId ? 'active' : ''}`} onClick={() => onCommunity(community)} title={community.name}><span>{community.name.slice(0, 2).toUpperCase()}</span></button>)}</div><button className="server-icon add-server" onClick={onCreateCommunity} title="Criar nova comunidade"><Plus size={21} /></button></aside>
    <aside className="channel-sidebar"><div className="community-header"><span>Mensagem privada</span><MessageCircle size={18} /></div><div className="community-scroll"><button className="channel-row selected" onClick={onBack}><Users size={18} /><span>Voltar ao lobby</span></button><div className="sidebar-section-title"><span>CONVERSA</span></div><div className="social-row"><span className="social-avatar">{friendName.slice(0, 2).toUpperCase()}</span><div><strong>{friendName}</strong><small>Amigo</small></div></div></div><div className="profile-bar"><div className="profile-summary"><Avatar initials={(activeUser?.name || 'VC').slice(0, 2).toUpperCase()} color="green" online small image={activeUser?.avatar_url} /><span className="profile-text"><strong>{activeUser?.name || 'Você'}</strong><small>Conversa privada</small></span></div></div></aside>
    <main className="main-panel"><header className="topbar"><div className="channel-heading"><MessageCircle size={21} /><strong>{friendName}</strong><span className="heading-divider" /><span className="channel-description">Conversa privada</span></div><div className="topbar-actions"><button className="topbar-icon" onClick={onBack} title="Voltar ao lobby"><Users size={20} /></button></div></header><section className="chat-layout"><div className="chat-content"><div className="welcome-card"><div className="welcome-icon"><MessageCircle size={27} /></div><h1>Conversa com {friendName}</h1><p>As mensagens desta conversa são privadas entre vocês.</p></div><div className="message-list">{messages.map((message) => { const mine = message.sender_id === activeUser?.id; return <article className="message" key={message.id}><Avatar initials={(mine ? activeUser?.name : friendName || 'AM').slice(0, 2).toUpperCase()} color={mine ? 'green' : 'blue'} online={mine} image={mine ? activeUser?.avatar_url : profile.avatar_url} /><div className="message-body"><div className="message-meta"><strong>{mine ? 'Você' : friendName}</strong><time>{new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></div><p>{message.content}</p></div></article>; })}</div><form className="composer" onSubmit={onSubmit}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Enviar mensagem privada para ${friendName}`} /><div className="composer-actions"><button className="send-button" type="submit" title="Enviar"><Send size={18} /></button></div></form></div><aside className="member-sidebar"><div className="member-group"><h3>AMIGO</h3><div className="member-row"><Avatar initials={friendName.slice(0, 2).toUpperCase()} color={profile.avatar_color || 'blue'} online small image={profile.avatar_url} /><span><strong>{friendName}</strong><small>Conversa privada</small></span></div></div></aside></section></main>
  </div>;
}

function FriendsModal({ search, setSearch, requests, friends, status, onSearch, onRespond, onClose }) {
  return <Modal title="Amigos" onClose={onClose}><div className="social-modal"><div className="social-add"><label>Adicionar por nome de exibição<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome exato do amigo" /></label><button className="primary-button" onClick={onSearch}><Plus size={15} /> Adicionar</button></div>{status && <p className="social-status">{status}</p>}<div className="social-section"><h3>Solicitações recebidas <span>{requests.length}</span></h3>{requests.length ? requests.map((request) => <div className="social-row" key={request.id}><span className="social-avatar">{request.other.display_name.slice(0, 2).toUpperCase()}</span><div><strong>{request.other.display_name}</strong><small>Quer ser seu amigo</small></div><button onClick={() => onRespond(request, 'accepted')}>Aceitar</button><button className="social-reject" onClick={() => onRespond(request, 'declined')}>Recusar</button></div>) : <p className="social-empty">Nenhuma solicitação pendente.</p>}</div><div className="social-section"><h3>Seus amigos <span>{friends.length}</span></h3>{friends.length ? friends.map((friend) => <div className="social-row" key={friend.id}><span className="social-avatar">{friend.other.display_name.slice(0, 2).toUpperCase()}</span><div><strong>{friend.other.display_name}</strong><small>Amigo</small></div><span className="friend-online-dot" /></div>) : <p className="social-empty">Você ainda não adicionou amigos.</p>}</div></div></Modal>;
}

function InviteModal({ inviteCode, setInviteCode, communityInvite, setCommunityInvite, status, friends = [], directStatus, onInviteFriend, onCreate, onAccept, onClose }) {
  const inviteError = communityInvite?.startsWith('Erro') || communityInvite?.startsWith('Entre');
  return <Modal title="Convidar para a comunidade" onClose={onClose}><div className="invite-modal"><p className="modal-note">A forma recomendada é convidar um amigo aceito diretamente. Ele receberá o convite no lobby e poderá entrar com um clique.</p><div className="social-section"><h3>Convidar amigo aceito</h3>{friends.length ? friends.map((friend) => { const profile = friend.other || {}; return <div className="social-row" key={friend.id}><span className="social-avatar">{(profile.display_name || 'AM').slice(0, 2).toUpperCase()}</span><div><strong>{profile.display_name || 'Amigo'}</strong><small>Amigo aceito</small></div><button className="secondary-button" onClick={() => onInviteFriend(friend)}>Convidar</button></div>; }) : <p className="social-empty">Você ainda não tem amigos aceitos para convidar.</p>}{directStatus && <p className="social-status">{directStatus}</p>}</div><div className="invite-divider"><span>código alternativo</span></div><p className="modal-note">Se preferir, ainda é possível gerar um código temporário para compartilhar manualmente.</p><button className="secondary-button" onClick={onCreate}><Plus size={15} /> Gerar código</button>{communityInvite && <div className={inviteError ? 'invite-error' : 'generated-invite'}><span>{communityInvite}</span>{!inviteError && <button onClick={() => navigator.clipboard?.writeText(communityInvite)}>Copiar</button>}</div>}<div className="invite-divider"><span>entrar com código</span></div><label>Código de convite<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Cole o código aqui" /></label><button className="secondary-button invite-join" onClick={onAccept}>Entrar na comunidade</button>{status && <p className="social-status">{status}</p>}</div></Modal>;
}

function SharePicker({ sources, sourceId, setSourceId, quality, setQuality, onStart, onClose }) {
  return <Modal title="Compartilhar sua tela" onClose={onClose}><div className="share-picker"><p className="modal-note">Escolha uma janela ou monitor. A prévia da sua transmissão aparecerá no canto da tela.</p><div className="source-grid">{sources.length ? sources.map((source) => <button key={source.id} className={`source-card ${source.id === sourceId ? 'active' : ''}`} onClick={() => setSourceId(source.id)}><img src={source.thumbnail} alt="" /><span>{source.name}</span><small>{source.type === 'screen' ? 'Tela inteira' : 'Janela'}</small></button>) : <button className="source-card active source-empty" onClick={() => setSourceId('screen:0:0')}><MonitorUp size={25} /><span>Tela inteira</span><small>Capturar o monitor principal</small></button>}</div><label className="quality-label">Qualidade<select value={quality} onChange={(event) => setQuality(event.target.value)}><option value="1080p">1080p · alta qualidade</option><option value="720p">720p · recomendada</option><option value="480p">480p · economiza banda</option></select></label><div className="share-picker-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={onStart}><MonitorUp size={16} /> Começar transmissão</button></div></div></Modal>;
}

function AuthScreen({ mode, setMode, email, setEmail, name, setName, password, setPassword, configured, busy, error, onSubmit }) {
  const signup = mode === 'signup';
  return <div className="auth-shell"><div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" /><section className="auth-card"><div className="auth-brand"><span>A</span><div><strong>Amigos</strong><small>comunidade privada</small></div></div><div className="auth-copy"><p className="eyebrow">PRIMEIRO ACESSO</p><h1>{signup ? 'Crie seu espaço com a gente.' : 'Que bom ver você de novo.'}</h1><p>{signup ? 'Cadastre uma conta para conversar com seus amigos em um só lugar.' : 'Entre com sua conta para continuar na comunidade.'}</p></div><form className="auth-form" onSubmit={onSubmit}>{signup && <label>Como podemos chamar você?<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" autoComplete="name" required /></label>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" required /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" minLength={4} autoComplete={signup ? 'new-password' : 'current-password'} required /></label>{error && <div className={`auth-message ${error.startsWith('Cadastro realizado') ? 'success' : ''}`}>{error}</div>}<button className="auth-submit" disabled={busy} type="submit">{busy ? 'Aguarde...' : signup ? 'Criar minha conta' : 'Entrar na comunidade'}</button></form><button className="auth-switch" onClick={() => setMode(signup ? 'login' : 'signup')}>{signup ? 'Já tenho uma conta' : 'Ainda não tenho conta'}</button><div className="auth-status"><span className={configured ? 'status-ok' : 'status-local'} />{configured ? 'Conexão segura ativada' : 'Modo local de demonstração'}<small>{configured ? 'Sua conta será sincronizada entre os computadores.' : 'As credenciais online serão ativadas após configurar o Supabase.'}</small></div></section></div>;
}

function Member({ name, status, initials, color, online, presence, role, isSelf, disconnected, onManageRole, onContextMenu }) {
  return <button className={`member-row ${presence === 'offline' ? 'offline' : ''} ${disconnected ? 'disconnected' : ''} ${isSelf ? 'member-self' : ''}`} onClick={onManageRole} onContextMenu={onContextMenu}><Avatar initials={initials} color={color} online={online} presence={presence} small /><span><strong>{name} {isSelf && <em className="you-badge">você</em>}</strong><small>{disconnected ? 'desconectado da sala' : `${presenceLabel(presence)} · ${role || status}`}</small></span></button>;
}

function Modal({ title, onClose, children, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className={`modal ${wide ? 'modal-wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h2>{title}</h2><button onClick={onClose}><X size={19} /></button></div>{children}</div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
