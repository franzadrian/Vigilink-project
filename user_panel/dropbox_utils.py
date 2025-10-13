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

def get_dropbox_client():
    """Initialize and return a Dropbox client instance.
    Prefers OAuth2 refresh token if provided; otherwise falls back to access token.
    Lookup order:
      1) Refresh token: env -> settings -> optional file (settings.DROPBOX_REFRESH_TOKEN_FILE)
      2) Access token:  env -> settings -> optional file (settings.DROPBOX_TOKEN_FILE) -> ACCESS_TOKEN fallback
    """
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
        try:
            dbx = dropbox.Dropbox(
                oauth2_refresh_token=refresh_token,
                app_key=APP_KEY,
                app_secret=APP_SECRET,
            )
            dbx.users_get_current_account()
            return dbx
        except AuthError:
            print("ERROR: Invalid Dropbox refresh token or app credentials")
        except Exception as e:
            print(f"ERROR: Dropbox init with refresh token failed: {e}")

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

    try:
        if not token:
            print("ERROR: Dropbox access token not configured")
            return None
        dbx = dropbox.Dropbox(token)
        dbx.users_get_current_account()
        return dbx
    except AuthError:
        print("ERROR: Invalid Dropbox access token")
        return None

def upload_file_to_dropbox(file_content, file_path, overwrite=False):
    """
    Upload a file to Dropbox
    
    Args:
        file_content: The file content to upload
        file_path: The path where to store the file in Dropbox
        overwrite: Whether to overwrite an existing file
    
    Returns:
        Shared link URL if successful, None otherwise
    """
    dbx = get_dropbox_client()
    if not dbx:
        return None

    mode = WriteMode.overwrite if overwrite else WriteMode.add

    try:
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
            result = dbx.files_upload(file_content, file_path, mode=mode, autorename=True)
        else:
            # If it's a file-like object, read it first
            file_content.seek(0)
            result = dbx.files_upload(file_content.read(), file_path, mode=mode, autorename=True)

        # Create or retrieve a shared link
        try:
            shared_link = dbx.sharing_create_shared_link_with_settings(result.path_lower)
            link_url = shared_link.url
        except ApiError:
            # If link already exists or cannot be created, try listing
            links = dbx.sharing_list_shared_links(path=result.path_lower, direct_only=True)
            link_url = links.links[0].url if links.links else None
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
