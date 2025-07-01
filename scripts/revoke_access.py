import paramiko
import time
import re
import sys
import json
import os

# Load environment variables
hostname = os.environ.get('FORTIGATE_IP')
port = int(os.environ.get('FORTIGATE_SSH_PORT', 22))
ssh_username = os.environ.get('FORTIGATE_SSH_USERNAME')
ssh_password = os.environ.get('FORTIGATE_SSH_PASSWORD')

def send_command(channel, command, sleep=1):
    channel.send(command + "\n")
    time.sleep(sleep)
    output = ""
    while channel.recv_ready():
        output += channel.recv(1024).decode()
    return output

def revoke_access(group_name, user_to_remove):
    try:
        # Create SSH client and connect
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname, port=port, username=ssh_username, password=ssh_password, look_for_keys=False, allow_agent=False)

        # Start an interactive shell
        channel = client.invoke_shell()
        time.sleep(1)  # Wait for the session to stabilize

        # Enter group configuration and get current configuration
        output = ""
        output += send_command(channel, "config user group")
        output += send_command(channel, f'edit "{group_name}"')
        output += send_command(channel, "show")

        # Extract the list of members
        pattern = r'set member\s+(.+)'
        match = re.search(pattern, output)
        if match:
            members_str = match.group(1)
            members = re.findall(r'"([^"]+)"', members_str)
        else:
            return {"success": False, "message": "No members found in the group."}

        if user_to_remove not in members:
            return {"success": False, "message": f"The user '{user_to_remove}' is not in the group."}

        # Create the list of members without the user to remove
        updated_members = [m for m in members if m != user_to_remove]

        # Update the configuration: reset the member list
        send_command(channel, f'edit "{group_name}"')
        send_command(channel, "unset member")
        if updated_members:
            members_command = "set member " + " ".join(f'"{m}"' for m in updated_members)
            send_command(channel, members_command)
        send_command(channel, "next")
        output_update = send_command(channel, "end")

        channel.close()
        client.close()

        return {"success": True, "message": f"User '{user_to_remove}' has been removed from the group '{group_name}'."}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

if __name__ == "__main__":
    # This block will be executed when the script is run directly
    if len(sys.argv) != 3:
        print("Usage: python revoke_access.py <group_name> <user_to_remove>")
        sys.exit(1)

    group_name = sys.argv[1]
    user_to_remove = sys.argv[2]

    result = revoke_access(group_name, user_to_remove)
    print(json.dumps(result))

