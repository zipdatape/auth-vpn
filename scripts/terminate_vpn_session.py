import paramiko
import time
import re
import sys
import json
import os

# Usar variables de entorno si están disponibles, de lo contrario usar los valores predeterminados
hostname = os.environ.get('FORTIGATE_IP')
port = int(os.environ.get('FORTIGATE_SSH_PORT', 22))
ssh_username = os.environ.get('FORTIGATE_SSH_USERNAME')
ssh_password = os.environ.get('FORTIGATE_SSH_PASSWORD')

# Función para imprimir mensajes de depuración a stderr
def debug_log(message):
    sys.stderr.write(f"{message}\n")
    sys.stderr.flush()

def send_command(channel, command, sleep=1, timeout=10):
    debug_log(f"Sending command: {command}")
    channel.send(command + "\n")
    time.sleep(sleep)
    
    # Esperar a que haya datos disponibles
    start_time = time.time()
    while not channel.recv_ready() and time.time() - start_time < timeout:
        time.sleep(0.1)
    
    # Leer todos los datos disponibles
    output_bytes = b""
    while channel.recv_ready():
        chunk = channel.recv(1024)
        output_bytes += chunk
        time.sleep(0.1)  # Pequeña pausa para asegurarnos de recibir todos los datos
    
    # Intentar decodificar con diferentes codificaciones
    for encoding in ['utf-8', 'latin-1', 'cp1252', 'ascii']:
        try:
            return output_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    
    # Si ninguna codificación funciona, usar latin-1 que puede manejar cualquier byte
    return output_bytes.decode('latin-1')

def terminate_vpn_sessions(username):
    try:
        debug_log(f"Attempting to terminate VPN sessions for user: {username}")
        debug_log(f"Connecting to {hostname}:{port} as {ssh_username}")
        
        # Create SSH client and connect
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname, port=port, username=ssh_username, password=ssh_password, look_for_keys=False, allow_agent=False)

        # Start an interactive shell
        channel = client.invoke_shell()
        time.sleep(1)  # Wait for the session to stabilize

        # First, get the list of active VPN sessions
        debug_log("Executing command: execute vpn sslvpn list")
        output = send_command(channel, "execute vpn sslvpn list", sleep=2)
        
        # Guardar la salida para depuración
        with open("vpn_list_output.txt", "w") as f:
            f.write(output)
        debug_log(f"Saved output to vpn_list_output.txt")
        
        # Parse the output to find sessions for the specified user
        sessions_to_terminate = []
        
        # Regular expression to match session entries based on the actual output format
        for line in output.split('\n'):
            # Skip header lines
            if "Index" in line or "SSL-VPN Login Users" in line or line.strip() == "":
                continue
                
            # Split the line by whitespace
            parts = re.split(r'\s+', line.strip())
            
            # Check if we have enough parts and the first part is a number (index)
            if len(parts) >= 2 and parts[0].isdigit():
                index = parts[0]
                session_username = parts[1]
                
                # Check if this session belongs to the user we want to terminate
                if session_username.lower() == username.lower() or username.lower().startswith(session_username.lower() + "@"):
                    sessions_to_terminate.append((index, session_username))
        
        if not sessions_to_terminate:
            result = {"success": False, "message": f"No active VPN sessions found for user '{username}'"}
            print(json.dumps(result))
            return
        
        # Terminate each session found
        terminated_sessions = []
        for index, session_username in sessions_to_terminate:
            debug_log(f"Terminating session {index} for user {session_username}")
            terminate_output = send_command(channel, f"execute vpn sslvpn del-tunnel {index}", sleep=1)
            terminated_sessions.append({"index": index, "username": session_username})
            
        channel.close()
        client.close()
        
        result = {
            "success": True, 
            "message": f"Terminated {len(terminated_sessions)} VPN sessions for user '{username}'",
            "terminated_sessions": terminated_sessions
        }
        
        # Imprimir solo el JSON como resultado final
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        debug_log(traceback_str)
        result = {"success": False, "message": f"Error: {str(e)}"}
        print(json.dumps(result))

def list_vpn_sessions():
    try:
        debug_log(f"Connecting to {hostname}:{port} as {ssh_username}")
        # Create SSH client and connect
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname, port=port, username=ssh_username, password=ssh_password, look_for_keys=False, allow_agent=False)

        # Start an interactive shell
        channel = client.invoke_shell()
        time.sleep(1)  # Wait for the session to stabilize

        # Get the list of active VPN sessions
        debug_log("Executing command: execute vpn sslvpn list")
        output = send_command(channel, "execute vpn sslvpn list", sleep=2)
        
        # Guardar la salida para depuración
        with open("vpn_list_output.txt", "w") as f:
            f.write(output)
        debug_log(f"Saved output to vpn_list_output.txt")
        
        # Parse the output to extract session information
        sessions = []
        
        for line in output.split('\n'):
            # Skip header lines
            if "Index" in line or "SSL-VPN Login Users" in line or line.strip() == "":
                continue
                
            # Split the line by whitespace
            parts = re.split(r'\s+', line.strip())
            
            # Check if we have enough parts and the first part is a number (index)
            if len(parts) >= 2 and parts[0].isdigit():
                session = {
                    'index': parts[0],
                    'username': parts[1]
                }
                
                # Add additional fields if available
                if len(parts) > 2:
                    session['group'] = parts[2]
                if len(parts) > 3:
                    session['auth_type'] = parts[3]
                if len(parts) > 5:
                    session['timeout'] = parts[5]
                if len(parts) > 7:
                    session['from_ip'] = parts[7]
                
                sessions.append(session)
            
        channel.close()
        client.close()
        
        result = {"success": True, "sessions": sessions}
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        debug_log(traceback_str)
        result = {"success": False, "message": f"Error: {str(e)}"}
        print(json.dumps(result))

def terminate_vpn_session_by_index(index):
    """Termina una sesión VPN específica por su índice"""
    try:
        debug_log(f"Attempting to terminate VPN session with index: {index}")
        debug_log(f"Connecting to {hostname}:{port} as {ssh_username}")
        
        # Create SSH client and connect
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname, port=port, username=ssh_username, password=ssh_password, 
                      look_for_keys=False, allow_agent=False)

        # Start an interactive shell
        channel = client.invoke_shell()
        time.sleep(1)  # Wait for the session to stabilize

        # Execute the command to terminate the session by index
        debug_log(f"Executing command: execute vpn sslvpn del-tunnel {index}")
        output = send_command(channel, f"execute vpn sslvpn del-tunnel {index}", sleep=2)
        
        # Guardar la salida para depuración
        with open(f"vpn_terminate_index_{index}_output.txt", "w") as f:
            f.write(output)
        debug_log(f"Saved output to vpn_terminate_index_{index}_output.txt")
        
        # Check if the command was successful
        if "tunnel deleted" in output.lower() or "ok" in output.lower():
            result = {"success": True, "message": f"VPN session with index {index} terminated successfully"}
        else:
            result = {"success": False, "message": f"Failed to terminate VPN session with index {index}"}
        
        channel.close()
        client.close()
        
        # Imprimir solo el JSON como resultado final
        print(json.dumps(result))
            
    except Exception as e:
        import traceback
        traceback_str = traceback.format_exc()
        debug_log(traceback_str)
        result = {"success": False, "message": f"Error: {str(e)}"}
        print(json.dumps(result))

def print_help():
    """Imprime el mensaje de ayuda del script"""
    debug_log("Usage: python terminate_vpn_session.py <command> [args]")
    debug_log("Commands:")
    debug_log("  terminate <username>    - Terminate all VPN sessions for a user")
    debug_log("  terminate-index <index> - Terminate a specific VPN session by index")
    debug_log("  list                    - List all active VPN sessions")
    debug_log("  debug                   - Print debug information about environment")
    debug_log("  help                    - Show this help message")
    
    # Imprimir un JSON válido para que la aplicación no falle al parsear
    print(json.dumps({"success": False, "message": "Help information printed to stderr"}))

if __name__ == "__main__":
    # This block will be executed when the script is run directly
    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)

    command = sys.argv[1]
    
    if command == "terminate":
        if len(sys.argv) != 3:
            print(json.dumps({"success": False, "message": "Usage: python terminate_vpn_session.py terminate <username>"}))
            sys.exit(1)
        username = sys.argv[2]
        terminate_vpn_sessions(username)
    
    elif command == "terminate-index":
        if len(sys.argv) != 3:
            print(json.dumps({"success": False, "message": "Usage: python terminate_vpn_session.py terminate-index <index>"}))
            sys.exit(1)
        index = sys.argv[2]
        terminate_vpn_session_by_index(index)
    
    elif command == "list":
        list_vpn_sessions()
    
    elif command == "debug":
        # Imprimir información de depuración a stderr
        debug_log(f"DEBUG: FORTIGATE_IP = {hostname}")
        debug_log(f"DEBUG: FORTIGATE_SSH_PORT = {port}")
        debug_log(f"DEBUG: FORTIGATE_SSH_USERNAME = {ssh_username}")
        debug_log(f"DEBUG: FORTIGATE_SSH_PASSWORD = {'*' * len(ssh_password)}")
        
        # Imprimir un JSON válido para que la aplicación no falle al parsear
        print(json.dumps({"success": True, "message": "Debug information printed to stderr"}))
        sys.exit(0)
    
    elif command in ["help", "--help", "-h"]:
        print_help()
        sys.exit(0)
    
    else:
        print(json.dumps({"success": False, "message": f"Unknown command: {command}"}))
        sys.exit(1)
