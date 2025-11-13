import os
import io
import dropbox
from dropbox.files import WriteMode
from dropbox.exceptions import ApiError, AuthError
from django.conf import settings
import uuid

# Dropbox credentials (prefer settings or environment variables; do not hardcode tokens)
APP_KEY = os.environ.get('DROPBOX_APP_KEY') or getattr(settings, 'DROPBOX_APP_KEY', None)
APP_SECRET = os.environ.get('DROPBOX_APP_SECRET') or getattr(settings, 'DROPBOX_APP_SECRET', None)

# Optional last-resort fallback token (avoid hardcoding secrets)
ACCESS_TOKEN = None

# Dropbox folder paths
PROFILE_PICTURES_PATH = '/vigilink/profile_pictures/'
POST_IMAGES_PATH = '/vigilink/post_images/'
CHAT_IMAGES_PATH = '/vigilink/chat_images/'
RESOURCES_PATH = '/vigilink/resources/'

def _get_dropbox_credentials():
    """Helper to get Dropbox credentials without creating a client"""
    # 1) Try refresh token flow first
    refresh_token = (
        os.environ.get('DROPBOX_REFRESH_TOKEN') or
        getattr(settings, 'DROPBOX_REFRESH_TOKEN', None)
    )
    if not refresh_token:
        rt_file = getattr(settings, 'DROPBOX_REFRESH_TOKEN_FILE', None)
        if rt_file:
            try:
                with open(rt_file, 'r', encoding='utf-8') as f:
                    refresh_token = f.read().strip()
            except Exception:
                refresh_token = None

    if refresh_token and APP_KEY and APP_SECRET:
        return ('refresh', refresh_token, APP_KEY, APP_SECRET)

    # 2) Fall back to long/short-lived access token
    token = (
        os.environ.get('DROPBOX_ACCESS_TOKEN') or
        getattr(settings, 'DROPBOX_ACCESS_TOKEN', None)
    )
    if not token:
        token_file = getattr(settings, 'DROPBOX_TOKEN_FILE', None)
        if token_file:
            try:
                with open(token_file, 'r', encoding='utf-8') as f:
                    token = f.read().strip()
            except Exception:
                token = None
    if not token and ACCESS_TOKEN:
        token = ACCESS_TOKEN
    
    if token:
        return ('token', token, None, None)
    
    return None

def get_dropbox_client(verify_account=True):
    """Initialize and return a Dropbox client instance.
    Prefers OAuth2 refresh token if provided; otherwise falls back to access token.
    Lookup order:
      1) Refresh token: env -> settings -> optional file (settings.DROPBOX_REFRESH_TOKEN_FILE)
      2) Access token:  env -> settings -> optional file (settings.DROPBOX_TOKEN_FILE) -> ACCESS_TOKEN fallback
    
    Args:
        verify_account: If True, verify account by calling users_get_current_account (default: True)
    """
    creds = _get_dropbox_credentials()
    if not creds:
        print("ERROR: Dropbox access token not configured")
        return None
    
    cred_type, token_or_refresh, app_key, app_secret = creds
    
    try:
        if cred_type == 'refresh':
            dbx = dropbox.Dropbox(
                oauth2_refresh_token=token_or_refresh,
                app_key=app_key,
                app_secret=app_secret,
            )
        else:
            dbx = dropbox.Dropbox(token_or_refresh)
        
        if verify_account:
            dbx.users_get_current_account()
        return dbx
    except AuthError:
        print("ERROR: Invalid Dropbox credentials")
        return None
    except Exception as e:
        print(f"ERROR: Dropbox init failed: {e}")
        return None

def get_dropbox_client_fast():
    """Get a Dropbox client without account verification (faster for threading)"""
    return get_dropbox_client(verify_account=False)

def upload_file_to_dropbox(file_content, file_path, overwrite=False, dbx_client=None):
    """
    Upload a file to Dropbox
    
    Args:
        file_content: The file content to upload (bytes or file-like object)
        file_path: The path where to store the file in Dropbox
        overwrite: Whether to overwrite an existing file
        dbx_client: Optional pre-initialized Dropbox client (for threading optimization)
    
    Returns:
        Shared link URL if successful, None otherwise
    """
    # Use provided client or get a new one
    dbx = dbx_client if dbx_client else get_dropbox_client()
    if not dbx:
        return None

    mode = WriteMode.overwrite if overwrite else WriteMode.add

    try:
        # Skip folder creation if client was provided (folder should be pre-created)
        if not dbx_client:
            # Ensure parent folder exists (create if missing)
            try:
                folder_path = os.path.dirname(file_path) or '/'
                if folder_path and folder_path != '/':
                    try:
                        dbx.files_create_folder_v2(folder_path)
                    except ApiError:
                        # Ignore if folder already exists or any conflict
                        pass
            except Exception:
                pass

        # Upload the file (enable autorename to avoid conflicts)
        if isinstance(file_content, bytes):
            file_bytes = file_content
        else:
            # If it's a file-like object, read it first
            if hasattr(file_content, 'seek'):
                file_content.seek(0)
            file_bytes = file_content.read() if hasattr(file_content, 'read') else file_content
        
        result = dbx.files_upload(file_bytes, file_path, mode=mode, autorename=True)

        # Create or retrieve a shared link
        try:
            shared_link = dbx.sharing_create_shared_link_with_settings(result.path_lower)
            link_url = shared_link.url
        except ApiError:
            # If link already exists or cannot be created, try listing
            try:
                links = dbx.sharing_list_shared_links(path=result.path_lower, direct_only=True)
                link_url = links.links[0].url if links.links else None
            except Exception:
                link_url = None
        
        dl_url = None
        if link_url:
            # Convert to direct download link
            dl_url = link_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
            dl_url = dl_url.replace('?dl=0', '')
        else:
            # As a fallback (e.g., when team policy disables shared links), use a temporary link
            try:
                temp = dbx.files_get_temporary_link(result.path_lower)
                dl_url = temp.link
            except Exception:
                dl_url = None
        if not dl_url:
            return None
        
        return dl_url
    except ApiError as e:
        print(f"API error: {e}")
        return None
    except Exception as e:
        print(f"Error uploading to Dropbox: {e}")
        return None

def upload_profile_picture(file, filename=None):
    """
    Upload a profile picture to Dropbox
    
    Args:
        file: The file object to upload
        filename: Optional filename, if not provided a UUID will be generated
    
    Returns:
        URL to the uploaded file if successful, None otherwise
    """
    if not filename:
        # Generate a unique filename
        ext = os.path.splitext(file.name)[1] if hasattr(file, 'name') else '.jpg'
        filename = f"{uuid.uuid4()}{ext}"
    
    file_path = f"{PROFILE_PICTURES_PATH}{filename}"
    return upload_file_to_dropbox(file, file_path)

def upload_post_image(file, filename=None):
    """
    Upload a post image to Dropbox
    
    Args:
        file: The file object to upload
        filename: Optional filename, if not provided a UUID will be generated
    
    Returns:
        URL to the uploaded file if successful, None otherwise
    """
    if not filename:
        # Generate a unique filename
        ext = os.path.splitext(file.name)[1] if hasattr(file, 'name') else '.jpg'
        filename = f"{uuid.uuid4()}{ext}"
    
    file_path = f"{POST_IMAGES_PATH}{filename}"
    return upload_file_to_dropbox(file, file_path)

def upload_chat_image(file, filename=None):
    """Upload a chat image to Dropbox (separate chat images folder)."""
    if not filename:
        # Generate a unique filename
        ext = os.path.splitext(file.name)[1] if hasattr(file, 'name') else '.jpg'
        filename = f"{uuid.uuid4()}{ext}"

    file_path = f"{CHAT_IMAGES_PATH}{filename}"
    return upload_file_to_dropbox(file, file_path)
