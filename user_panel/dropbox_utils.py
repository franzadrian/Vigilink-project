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
# For this school project, use a hardcoded fallback token if no env/setting provided
ACCESS_TOKEN = (
    os.environ.get('DROPBOX_ACCESS_TOKEN')
    or getattr(settings, 'DROPBOX_ACCESS_TOKEN', None)
    or 'sl.u.AGDkhWU4Zco3K8-YKc-yGMdnEkmQfr1Qh7wC5YVgougO7gDmKxEbXFfmrGNZcN-FV-73CAzuj55kRWIAh6Kb0tjc4auMW2eDeSNa9lQmp6gSCAD-y6ktm59P_l7ghTsanUPcFDS-t6-h-UhcJKBuklqsw8fI4e_fWDzaH5H_KX1EuiTSZqwJkpvIWviB4-MYyFSNOqQG_HZK4MmZPJ7DG4Fp6MJ-IOzqo6vrU8SmPd8cVuDgWnjzf6fCn5dwkGcHLkTac9HrE6Htqm9tZglNQteGIUJ_c0nXKEKhK4OuNw4Yk6Yq2qxNOHxxvA3iXrI0M9RLLxjXFSZQB91o_zGvp5QwY-5RFupddBr6Uy4u02mC1S2-zwAFaoVQ5DORH1Jte0ioN_gSAWVpC6HpYWS2azTOd7NBTQzHOlja-7QLgPYyzTzla7TBb_QusnRuxrBwQ9oGab9osA7wbgBRCoJ8LJUclQ_L9xu7a3VyZNZX7-7_5IsqkWkfTGAJpU76NkwPxkgbUsKXoONeEE-_29DjaZ9d_x8BV0zlsC_vTcDPKkjJOSKQTnlT-kvlZMFlt_tRDEh25itUXWf_sm_frWP6QRklL4UGrxilCs_oGfWOJ3iHhRp6YMYrXzykVwUt-Del9MUX4wgALFsiMrSIlgPLrXLzMPhlseN1uuM6DYUKKNg3GszY6MTiRdcPaaBBk9SRH_0emlhPMa-J0Vz0UHpUnGu44NLGyA6CBGmQbd_26fQCPuT8ilfQq8RSnbR0ZrNYXyzF4Q2q9y5BDBX5IiOz3akN-Il38Wx72cog4sS9--4zqP7AQWPyOFMhIYvefirGCcFzoWjslqMgWg_Fun3pyp1es2uWXZGDqPQPCnyenloSL_K_rxf7Z79FOFRnwBhm8YzDQ_32mP3bCJTw8LfejS0f54qqUMT8r2btMZqvJbEvoTtFmK_-b3-m_q4xvGhOFpho55IpwF5XofquvQiEvdxOKCdoMfK3QzSL123kAjnnVbvAq2gGaR91C0cZRFo7M_Tvt1RTbVXR5KOC_3dre4JWBMgvep-CrRkNuDvgl5qljqjwbXxB1FOPZpvIY6-KqPxPScamiYy-jD65FC18DfSfuLFOBEX3hHDkqEoO5sqFCl6e1PMWMp_CBGSuIsLhwbZZRcfl2lypklaHA9YowzbKm9XSpD7JXNaowESbppMsrvDLkSrOj5tcEZgoIBHU5aSSl8e7AI6zHDsn-bYpd6Xo9u36SeT-ZQdzj9m2KvGG6kcApnog84gA04jFu_kT6yrh346HUE5qUkWQJaraPOxve3wpbAJNDb9VSc61LbKtEGBTsHpTTYB_7wDU73eM4sPUziZduH-zu1Yir4_w6-iAzSyyZZ0jIWgujG6I3ILI0t3o2picc_2vkZ0rHu-mS4VLdfWdv4_FGPMGEDN7deITt08yYlywslaheVcjh_2A-A'
)

# Dropbox folder paths
PROFILE_PICTURES_PATH = '/vigilink/profile_pictures/'
POST_IMAGES_PATH = '/vigilink/post_images/'
CHAT_IMAGES_PATH = '/vigilink/chat_images/'

def get_dropbox_client():
    """Initialize and return a Dropbox client instance.
    Looks up token in env, settings, then optional token file path.
    """
    # Resolve token dynamically (in case env/settings changed after import)
    token = (
        os.environ.get('DROPBOX_ACCESS_TOKEN') or
        getattr(settings, 'DROPBOX_ACCESS_TOKEN', None) or
        ACCESS_TOKEN
    )
    # Optional token file path
    if not token:
        token_file = getattr(settings, 'DROPBOX_TOKEN_FILE', None)
        if token_file:
            try:
                with open(token_file, 'r', encoding='utf-8') as f:
                    token = f.read().strip()
            except Exception:
                token = None
    try:
        if not token:
            print("ERROR: Dropbox access token not configured")
            return None
        dbx = dropbox.Dropbox(token)
        # Check that the access token is valid
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
