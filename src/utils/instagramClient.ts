// src/utils/instagramClient.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger';

export interface InstagramPost {
  id: string;
  shortcode: string;
  caption: string;
  imageUrl: string;
  timestamp: string;
  likes: number;
  comments: number;
  url: string;
}

export interface InstagramProfile {
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl: string;
  postCount: number;
  followers: number;
  following: number;
  isVerified: boolean;
}

// Simple Instagram scraper (no login required for public profiles)
export async function getInstagramProfile(username: string): Promise<InstagramProfile | null> {
  try {
    const url = `https://www.instagram.com/${username}/`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Extract JSON data from script tag
    const scriptTags = $('script[type="application/ld+json"]');
    let profileData = null;
    
    scriptTags.each((i, elem) => {
      try {
        const content = $(elem).html();
        if (content) {
          const data = JSON.parse(content);
          if (data['@type'] === 'Person' || data.mainEntityofPage) {
            profileData = data;
            return false; // break loop
          }
        }
      } catch (e) {
        // Continue to next script tag
      }
    });

    if (!profileData) {
      // Fallback: try to extract from window._sharedData
      const sharedDataMatch = response.data.match(/window\._sharedData = ({.*?});/);
      if (sharedDataMatch) {
        const sharedData = JSON.parse(sharedDataMatch[1]);
        const userInfo = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user;
        
        if (userInfo) {
          return {
            username: userInfo.username,
            fullName: userInfo.full_name || '',
            biography: userInfo.biography || '',
            profilePicUrl: userInfo.profile_pic_url || '',
            postCount: userInfo.edge_owner_to_timeline_media?.count || 0,
            followers: userInfo.edge_followed_by?.count || 0,
            following: userInfo.edge_follow?.count || 0,
            isVerified: userInfo.is_verified || false
          };
        }
      }
      
      throw new Error('Could not extract profile data');
    }

    return {
      username,
      fullName: profileData.name || '',
      biography: profileData.description || '',
      profilePicUrl: profileData.image || '',
      postCount: 0, // Not available in LD+JSON
      followers: 0, // Not available in LD+JSON
      following: 0, // Not available in LD+JSON
      isVerified: false // Not available in LD+JSON
    };

  } catch (error) {
    logger.error(`Error fetching Instagram profile for ${username}: ${error}`);
    return null;
  }
}

export async function getInstagramPosts(username: string, limit: number = 12): Promise<InstagramPost[]> {
  try {
    const url = `https://www.instagram.com/${username}/`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    // Try to extract posts from window._sharedData
    const sharedDataMatch = response.data.match(/window\._sharedData = ({.*?});/);
    if (!sharedDataMatch) {
      throw new Error('Could not find shared data');
    }

    const sharedData = JSON.parse(sharedDataMatch[1]);
    const posts = sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user?.edge_owner_to_timeline_media?.edges || [];

    return posts.slice(0, limit).map((edge: any) => {
      const node = edge.node;
      return {
        id: node.id,
        shortcode: node.shortcode,
        caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
        imageUrl: node.display_url || node.thumbnail_src,
        timestamp: new Date(node.taken_at_timestamp * 1000).toISOString(),
        likes: node.edge_liked_by?.count || 0,
        comments: node.edge_media_to_comment?.count || 0,
        url: `https://www.instagram.com/p/${node.shortcode}/`
      };
    });

  } catch (error) {
    logger.error(`Error fetching Instagram posts for ${username}: ${error}`);
    return [];
  }
}

// Alternative method using RSS-Bridge (if available)
export async function getInstagramPostsViaRSS(username: string): Promise<InstagramPost[]> {
  try {
    // This would require setting up RSS-Bridge service
    // For now, return empty array
    logger.warn('Instagram RSS method not implemented - requires RSS-Bridge service');
    return [];
  } catch (error) {
    logger.error(`Error fetching Instagram posts via RSS for ${username}: ${error}`);
    return [];
  }
}