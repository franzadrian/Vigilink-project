"""
Custom Dropbox storage backend for Django FileField
"""
import os
import logging
from django.core.files.storage import Storage
from django.core.files.base import ContentFile
from django.conf import settings
from django.core.cache import cache
from user_panel.dropbox_utils import get_dropbox_client, get_dropbox_client_fast, RESOURCES_PATH
from dropbox.files import WriteMode
from dropbox.exceptions import ApiError
import uuid

logger = logging.getLogger(__name__)

# Cache URLs for 1 hour (3600 seconds)
URL_CACHE_TIMEOUT = 3600


class DropboxStorage(Storage):
    """
    A Django storage backend that stores files in Dropbox
    """
    
    def __init__(self, location=None, base_url=None):
        self.location = location or RESOURCES_PATH
        self.base_url = base_url or ''
    
    def _open(self, name, mode='rb'):
        """
        Open a file from Dropbox
        """
        dbx = get_dropbox_client()
        if not dbx:
            raise IOError("Dropbox client unavailable")
        
        try:
            file_path = os.path.join(self.location, name).replace('\\', '/')
            # Ensure path starts with /
            if not file_path.startswith('/'):
                file_path = '/' + file_path
            
            metadata, response = dbx.files_download(file_path)
            file_content = response.content
            return ContentFile(file_content)
        except ApiError as e:
            if e.error.is_path() and e.error.get_path().is_not_found():
                raise FileNotFoundError(f"File not found: {name}")
            raise IOError(f"Error opening file from Dropbox: {e}")
    
    def _save(self, name, content):
        """
        Save a file to Dropbox
        Optimized for faster uploads
        """
        dbx = get_dropbox_client_fast()
        if not dbx:
            raise IOError("Dropbox client unavailable")
        
        # Generate unique filename if needed
        if not name or name == '':
            ext = os.path.splitext(getattr(content, 'name', ''))[1] or '.bin'
            name = f"{uuid.uuid4()}{ext}"
        
        # Ensure name doesn't have leading slash or backslashes
        name = name.lstrip('/').replace('\\', '/')
        
        # Construct full path
        file_path = os.path.join(self.location, name).replace('\\', '/')
        # Ensure path starts with /
        if not file_path.startswith('/'):
            file_path = '/' + file_path
        
        try:
            # Ensure parent folder exists (only if needed - Dropbox requires parent to exist)
            # Use a simple approach: try to create, ignore if exists
            folder_path = os.path.dirname(file_path) or '/'
            if folder_path and folder_path != '/':
                try:
                    dbx.files_create_folder_v2(folder_path)
                except ApiError as e:
                    # Folder already exists or other error - ignore and continue
                    # Most uploads will hit this after first file, which is fine
                    pass
            
            # Optimized: Upload file directly - Django file objects are already in memory
            # Read file content once and upload
            if hasattr(content, 'read'):
                content.seek(0)
                file_content = content.read()
                result = dbx.files_upload(file_content, file_path, mode=WriteMode.overwrite, autorename=True)
            else:
                # Content is already bytes
                file_content = content
                result = dbx.files_upload(file_content, file_path, mode=WriteMode.overwrite, autorename=True)
            
            # Return the relative path (name) for storage in database
            return name
            
        except ApiError as e:
            raise IOError(f"Error saving file to Dropbox: {e}")
    
    def delete(self, name):
        """
        Delete a file from Dropbox
        """
        dbx = get_dropbox_client()
        if not dbx:
            raise IOError("Dropbox client unavailable")
        
        try:
            file_path = os.path.join(self.location, name).replace('\\', '/')
            if not file_path.startswith('/'):
                file_path = '/' + file_path
            
            dbx.files_delete_v2(file_path)
        except ApiError as e:
            if e.error.is_path() and e.error.get_path().is_not_found():
                # File doesn't exist, consider it deleted
                return
            raise IOError(f"Error deleting file from Dropbox: {e}")
    
    def exists(self, name):
        """
        Check if a file exists in Dropbox
        """
        dbx = get_dropbox_client()
        if not dbx:
            return False
        
        try:
            file_path = os.path.join(self.location, name).replace('\\', '/')
            if not file_path.startswith('/'):
                file_path = '/' + file_path
            
            dbx.files_get_metadata(file_path)
            return True
        except ApiError as e:
            if e.error.is_path() and e.error.get_path().is_not_found():
                return False
            return False
    
    def url(self, name):
        """
        Return the URL for accessing the file
        This creates a temporary shared link with direct download enabled
        Uses caching to avoid repeated API calls
        """
        if not name:
            return ''
        
        # Check cache first
        cache_key = f'dropbox_url_{name}'
        cached_url = cache.get(cache_key)
        if cached_url:
            return cached_url
        
        # Use fast client (no account verification) for better performance
        dbx = get_dropbox_client_fast()
        if not dbx:
            return ''
        
        try:
            # Handle the file path - name might already include the location or be relative
            if name.startswith(self.location):
                file_path = name.replace('\\', '/')
            elif name.startswith('/'):
                # If name already starts with /, check if it includes location
                if self.location in name:
                    file_path = name.replace('\\', '/')
                else:
                    file_path = os.path.join(self.location, name.lstrip('/')).replace('\\', '/')
            else:
                file_path = os.path.join(self.location, name).replace('\\', '/')
            
            # Ensure path starts with /
            if not file_path.startswith('/'):
                file_path = '/' + file_path
            
            # Normalize path (remove double slashes, etc.)
            file_path = file_path.replace('//', '/')
            
            logger.debug(f"Looking for file at path: {file_path}")
            
            link_url = None
            
            # Try to get existing link first (faster than creating new one)
            try:
                links = dbx.sharing_list_shared_links(path=file_path, direct_only=True)
                if links.links:
                    link_url = links.links[0].url
            except Exception:
                pass
            
            # If no existing link, create one
            if not link_url:
                try:
                    shared_link = dbx.sharing_create_shared_link_with_settings(file_path)
                    link_url = shared_link.url
                except ApiError as e:
                    # Link might already exist, try to get it again
                    if e.error.is_shared_link_already_exists():
                        try:
                            links = dbx.sharing_list_shared_links(path=file_path, direct_only=True)
                            if links.links:
                                link_url = links.links[0].url
                        except Exception:
                            pass
            
            # Determine if file should be displayed or downloaded based on extension
            if link_url:
                file_ext = os.path.splitext(name)[1].lower()
                # Files that should be displayed in browser (images, videos)
                display_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.ogg', '.mov', '.avi']
                # Files that should be downloaded (documents, text files, etc.)
                download_extensions = ['.txt', '.csv', '.pdf', '.xlsx', '.xls', '.doc', '.docx', '.zip', '.rar']
                
                should_display = file_ext in display_extensions
                should_download = file_ext in download_extensions
                
                if should_display:
                    # Convert www.dropbox.com to dl.dropboxusercontent.com for direct access
                    # This allows images and videos to be displayed directly in <img> and <video> tags
                    if 'www.dropbox.com' in link_url:
                        link_url = link_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                    
                    # Remove download parameter for display
                    if '?dl=0' in link_url:
                        link_url = link_url.replace('?dl=0', '')
                    elif '?dl=1' in link_url:
                        link_url = link_url.replace('?dl=1', '')
                    
                    # Remove any other query parameters but keep the URL intact
                    if '?' in link_url and '?dl=' not in link_url:
                        parts = link_url.split('?')
                        if len(parts) > 1:
                            query = parts[1]
                            if 'dl=' not in query and 'raw=' not in query:
                                link_url = parts[0]
                elif should_download:
                    # For downloadable files, ensure ?dl=1 is present to force download
                    # Keep the original www.dropbox.com URL format for downloads
                    if '?dl=0' in link_url:
                        link_url = link_url.replace('?dl=0', '?dl=1')
                    elif '?dl=1' not in link_url:
                        # Add ?dl=1 if not present
                        if '?' in link_url:
                            link_url += '&dl=1'
                        else:
                            link_url += '?dl=1'
                else:
                    # For unknown file types, default to download
                    if '?dl=0' in link_url:
                        link_url = link_url.replace('?dl=0', '?dl=1')
                    elif '?dl=1' not in link_url:
                        if '?' in link_url:
                            link_url += '&dl=1'
                        else:
                            link_url += '?dl=1'
                
                # Ensure URL is properly formatted
                if not link_url.startswith('http'):
                    logger.warning(f"Invalid URL format: {link_url}")
                
                # Cache the URL
                cache.set(cache_key, link_url, URL_CACHE_TIMEOUT)
                logger.info(f"Generated Dropbox URL for {name}: {link_url}")
                return link_url
            
            # Fallback: try to get a temporary link if shared link creation fails
            try:
                temp_link = dbx.files_get_temporary_link(file_path)
                temp_url = temp_link.link
                if temp_url:
                    cache.set(cache_key, temp_url, URL_CACHE_TIMEOUT)
                    logger.info(f"Generated temporary Dropbox URL for {name}: {temp_url[:50]}...")
                    return temp_url
            except Exception as e:
                logger.warning(f"Could not get temporary link for {name}: {e}")
            
            logger.warning(f"No link URL generated for {name}")
            return ''
        except Exception as e:
            # Log error but don't crash
            logger.error(f"Error getting Dropbox URL for {name}: {e}", exc_info=True)
            return ''
    
    def size(self, name):
        """
        Return the size of the file
        """
        dbx = get_dropbox_client()
        if not dbx:
            return 0
        
        try:
            file_path = os.path.join(self.location, name).replace('\\', '/')
            if not file_path.startswith('/'):
                file_path = '/' + file_path
            
            metadata = dbx.files_get_metadata(file_path)
            if hasattr(metadata, 'size'):
                return metadata.size
            return 0
        except ApiError:
            return 0

