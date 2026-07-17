# Shared core utilities for the Receptify backend platform

# Helper to convert snake_case keys in dictionary to camelCase for the frontend
def to_camel_case(data):
    if isinstance(data, list):
        return [to_camel_case(item) for item in data]
    elif isinstance(data, dict):
        new_dict = {}
        for key, value in data.items():
            parts = key.split('_')
            camel_key = parts[0] + ''.join(x.title() for x in parts[1:])
            new_dict[camel_key] = to_camel_case(value)
        return new_dict
    else:
        return data
