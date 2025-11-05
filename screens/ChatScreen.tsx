import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import NotificationService from '../services/NotificationService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

type Message = {
  id: string;
  message_text: string;
  sender_id: string;
  sender_type: 'user' | 'doctor' | 'nurse';
  sender_name: string;
  is_own_message: boolean;
  created_at: string;
  message_type: string;
};

type Conversation = {
  id: string;
  conversation_type: string;
  conversation_name: string | null;
  participants: Array<{
    participant_id: string;
    participant_type: string;
    name: string;
  }>;
  latest_message: Message | null;
  unread_count: number;
  updated_at: string;
};

type SearchUser = {
  id: string;
  username: string;
  full_name: string;
  user_type: 'user' | 'doctor' | 'nurse';
};

export default function ChatScreen() {
  const { user, sessionToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // New chat modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversations
  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        headers: {
          'Cookie': `bl_session=${sessionToken}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to load conversations');
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load messages for selected conversation
  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages?conversation_id=${conversationId}`,
        {
          headers: {
            'Cookie': `bl_session=${sessionToken}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to load messages');
      const data = await response.json();
      setMessages(data.messages || []);
      
      // Mark as read
      await fetch(`${API_BASE_URL}/api/chat/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `bl_session=${sessionToken}`,
        },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      
      // Refresh conversations to update unread count
      loadConversations();
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `bl_session=${sessionToken}`,
        },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          message_text: newMessage.trim(),
          message_type: 'text',
        }),
      });
      
      if (!response.ok) throw new Error('Failed to send message');
      
      setNewMessage('');
      await loadMessages(selectedConversation.id);
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Search users
  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/search-users?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Cookie': `bl_session=${sessionToken}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to search users');
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Start new conversation
  const startConversation = async (selectedUser: SearchUser) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `bl_session=${sessionToken}`,
        },
        body: JSON.stringify({
          participant_id: selectedUser.id,
          participant_type: selectedUser.user_type,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create conversation');
      const data = await response.json();
      
      // Reload conversations and select the new one
      await loadConversations();
      const newConv = conversations.find((c) => c.id === data.conversation_id);
      if (newConv) {
        setSelectedConversation(newConv);
        loadMessages(newConv.id);
      }
      
      // Close modal
      setShowNewChatModal(false);
      setUserSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(userSearchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Poll for new messages
  useEffect(() => {
    if (selectedConversation) {
      pollIntervalRef.current = setInterval(() => {
        loadMessages(selectedConversation.id);
      }, 5000); // Poll every 5 seconds
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [selectedConversation]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return c.participants.some((p) => p.name.toLowerCase().includes(query));
  });

  const getConversationName = (conv: Conversation) => {
    if (conv.conversation_name) return conv.conversation_name;
    const otherParticipants = conv.participants.filter(
      (p) => p.participant_id !== user?.id
    );
    return otherParticipants.map((p) => p.name).join(', ') || 'Conversation';
  };

  const getTotalUnread = () => {
    return conversations.reduce((sum, c) => sum + c.unread_count, 0);
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        selectedConversation?.id === item.id && styles.conversationItemSelected,
      ]}
      onPress={() => {
        setSelectedConversation(item);
        loadMessages(item.id);
      }}
    >
      <View style={styles.conversationAvatar}>
        <Ionicons name="person-circle" size={48} color="#667eea" />
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {getConversationName(item)}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
        {item.latest_message && (
          <Text style={styles.latestMessage} numberOfLines={1}>
            {item.latest_message.message_text}
          </Text>
        )}
        <Text style={styles.timestamp}>
          {new Date(item.updated_at).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.is_own_message ? styles.messageRight : styles.messageLeft,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          item.is_own_message ? styles.messageBubbleOwn : styles.messageBubbleOther,
        ]}
      >
        {!item.is_own_message && (
          <Text style={styles.senderName}>{item.sender_name}</Text>
        )}
        <Text
          style={[
            styles.messageText,
            item.is_own_message && styles.messageTextOwn,
          ]}
        >
          {item.message_text}
        </Text>
        <Text
          style={[
            styles.messageTime,
            item.is_own_message && styles.messageTimeOwn,
          ]}
        >
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
      </View>
    </View>
  );

  const renderSearchUserItem = ({ item }: { item: SearchUser }) => (
    <TouchableOpacity
      style={styles.searchUserItem}
      onPress={() => startConversation(item)}
    >
      <View style={styles.searchUserAvatar}>
        <Ionicons name="person" size={24} color="#667eea" />
      </View>
      <View style={styles.searchUserContent}>
        <Text style={styles.searchUserName}>{item.full_name}</Text>
        <Text style={styles.searchUserUsername}>@{item.username}</Text>
        <View style={styles.userTypeBadge}>
          <Text style={styles.userTypeBadgeText}>
            {item.user_type === 'user' ? 'Patient' : item.user_type === 'doctor' ? 'Doctor' : 'Nurse'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Please log in to access chats</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedConversation) {
    // Chat View
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity
              onPress={() => setSelectedConversation(null)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <Ionicons name="person-circle" size={40} color="#fff" />
              <View style={styles.chatHeaderText}>
                <Text style={styles.chatHeaderTitle}>
                  {getConversationName(selectedConversation)}
                </Text>
              </View>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Conversations List View
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Chats</Text>
          {getTotalUnread() > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{getTotalUnread()}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => setShowNewChatModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Conversations List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Start a new chat to begin messaging</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.conversationsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#667eea']} />
          }
        />
      )}

      {/* New Chat Modal */}
      <Modal
        visible={showNewChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Start New Chat</Text>
            <TouchableOpacity onPress={() => setShowNewChatModal(false)}>
              <Ionicons name="close" size={28} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchContainer}>
            <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by username..."
              placeholderTextColor="#9ca3af"
              value={userSearchQuery}
              onChangeText={setUserSearchQuery}
              autoFocus
            />
          </View>

          {searchLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyContainer}>
              {userSearchQuery.length < 2 ? (
                <>
                  <Ionicons name="search-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>No users found</Text>
                </>
              )}
            </View>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderSearchUserItem}
              keyExtractor={(item) => `${item.user_type}-${item.id}`}
              contentContainerStyle={styles.searchResultsList}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  newChatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  conversationsList: {
    paddingBottom: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  conversationItemSelected: {
    backgroundColor: '#f3f4f6',
  },
  conversationAvatar: {
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  latestMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  chatHeaderText: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
  },
  messageLeft: {
    alignItems: 'flex-start',
  },
  messageRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleOwn: {
    backgroundColor: '#667eea',
  },
  messageBubbleOther: {
    backgroundColor: '#f3f4f6',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#111827',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchResultsList: {
    paddingBottom: 16,
  },
  searchUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchUserAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchUserContent: {
    flex: 1,
  },
  searchUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  searchUserUsername: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  userTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  userTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#667eea',
  },
});
