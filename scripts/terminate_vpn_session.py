import paramiko
import time
import re
import sys
import json
import os

# Credenciales definidas directamente para pruebas
# IMPORTANTE: Reemplaza estos valores con tus credenciales reales
# FORTIGATE_IP = "10.172.0.1"  # Reemplaza con la IP de tu FortiGate
# FORTIGATE_SSH_PORT = 1337    # Reemplaza con el puerto SSH de tu FortiGate
# FORTIGATE_SSH_USERNAME = "user"  # Reemplaza con tu nombre de usuario
# FORTIGATE_SSH_PASSWORD = "password"  # Reemplaza con tu contraseña

# Usar variables de entorno si están disponibles, de lo contrario usar los valores predeterminados
hostname = os.environ.get('FORTIGATE_IP', FORTIGATE_IP)
port = int(os.environ.get('FORTIGATE_SSH_PORT', FORTIGATE_SSH_PORT))
ssh_username = os.environ.get('FORTIGATE_SSH_USERNAME', FORTIGATE_SSH_USERNAME)
ssh_password = os.environ.get('FORTIGATE_SSH_PASSWORD', FORTIGATE_SSH_PASSWORD)

def send_command(channel, command, sleep=1, timeout=10):
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
        print(f"Connecting to {hostname}:{port} as {ssh_username}")
        # Create SSH client and connect
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname, port=port, username=ssh_username, password=ssh_password, look_for_keys=False, allow_agent=False)

        # Start an interactive shell
        channel = client.invoke_shell()
        time.sleep(1)  # Wait for the session to stabilize

        # First, get the list of active VPN sessions
        print("Executing command: execute vpn sslvpn list")
        output = send_command(channel, "execute vpn sslvpn list", sleep=2)
        
        # Guardar la salida para depuración
        with open("vpn_list_output.txt", "w") as f:
            f.write(output)
        print(f"Saved output to vpn_list_output.txt")
        
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
            return {"success": False, "message": f"No active VPN sessions found for user '{username}'"}
        
        # Terminate each session found
        terminated_sessions = []
        for index, session_username in sessions_to_terminate:
            print(f"Terminating session {index} for user {session_username}")
            terminate_output = send_command(channel, f"execute vpn sslvpn del-tunnel {index}", sleep=1)
            terminated_sessions.append({"index": index, "username": session_username})
            
        channel.close()
        client.close()
        
        return {
            "success": True, 
            "message": f"Terminated {len(terminated_sessions)} VPN sessions for user '{username}'",
            "terminated_sessions": terminated_sessions
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Error: {str(e)}"}

def list_vpn_sessions():
    try:
        print(f"Connecting to {hostname}:{port} as {ssh_username}")
        # Create SSH client and connect
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(hostname, port=port, username=ssh_username, password=ssh_password, look_for_keys=False, allow_agent=False)

        # Start an interactive shell
        channel = client.invoke_shell()
        time.sleep(1)  # Wait for the session to stabilize

        # Get the list of active VPN sessions
        print("Executing command: execute vpn sslvpn list")
        output = send_command(channel, "execute vpn sslvpn list", sleep=2)
        
        # Guardar la salida para depuración
        with open("vpn_list_output.txt", "w") as f:
            f.write(output)
        print(f"Saved output to vpn_list_output.txt")
        
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
        
        return {"success": True, "sessions": sessions}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Error: {str(e)}"}

if __name__ == "__main__":
    # This block will be executed when the script is run directly
    if len(sys.argv) < 2:
        print("Usage: python terminate_vpn_session.py <command> [args]")
        print("Commands:")
        print("  terminate <username> - Terminate all VPN sessions for a user")
        print("  list - List all active VPN sessions")
        sys.exit(1)

    command = sys.argv[1]
    
    if command == "terminate":
        if len(sys.argv) != 3:
            print("Usage: python terminate_vpn_session.py terminate <username>")
            sys.exit(1)
        username = sys.argv[2]
        result = terminate_vpn_sessions(username)
        print(json.dumps(result))
    elif command == "list":
        result = list_vpn_sessions()
        print(json.dumps(result))
    else:
        print(f"Unknown command: {command}")
        print("Available commands: terminate, list")
        sys.exit(1)